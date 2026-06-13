'use server'

import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { auth } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import { withDb } from '@/lib/db'
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits'
import { generatePublicId, formatPublicId } from '@/lib/public-id'

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

function sanitizeFilename(filename: string): string {
  // パス区切り・制御文字を除去し、ベース名のみ・長さ上限を適用
  const base = filename.split(/[/\\]/).pop() ?? 'file'
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '') // 制御文字
    .replace(/[^a-zA-Z0-9._-]/g, '_') // 許可文字以外を _ に
    .replace(/^\.+/, '') // 先頭ドット除去
    .slice(0, 200)
  return cleaned || 'file'
}

export async function getPresignedUploadUrl(filename: string, contentType: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  if (contentType !== 'application/pdf') {
    throw new Error('Only PDF files are allowed')
  }

  const deckId = randomUUID()
  const safeName = sanitizeFilename(filename)
  const key = `uploads/${deckId}/${safeName}`

  // presigned POST: content-length-range で S3 側がサイズ上限を強制する
  // （クライアント改ざんでは回避不可。超過分は S3 が EntityTooLarge で拒否）
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_UPLOAD_BYTES],
      ['eq', '$Content-Type', 'application/pdf'],
    ],
    Fields: {
      'Content-Type': 'application/pdf',
    },
    Expires: 300,
  })

  return { url, fields, key, deckId }
}

// 採番リトライ対象のDBエラー（UNIQUE違反 / OCC コンフリクト）を判定する。
// pg はエラーに SQLSTATE を `code` として持つ。
//   23505: unique_violation（slug の UNIQUE 衝突）
//   40001: serialization_failure（DSQL の楽観的同時実行制御コンフリクト）
//   OC000/OC001: DSQL 固有の OCC コンフリクトコード
function isRetryableDeckInsertError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  if (!code) return false
  return code === '23505' || code === '40001' || code.startsWith('OC')
}

const MAX_DECK_ID_RETRIES = 5

export async function createDeckRecord(params: {
  deckId: string
  fileKey: string
  title: string
  description: string
  category: string
  originalLanguage: string
  targetLanguages: string[]
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // fileKey は getPresignedUploadUrl が発行した `uploads/{deckId}/...` 形式のみ許可。
  // 他人の fileKey を指定して自分のデッキとして登録する攻撃を防ぐ。
  if (!params.fileKey.startsWith(`uploads/${params.deckId}/`)) {
    throw new Error('Invalid file key')
  }

  // 公開識別子（正規形10文字）を採番。UNIQUE/OCC 衝突時は新IDで再試行する。
  // short_id は新規採番せず NULL（旧URLリダイレクト専用列）。legacy_slug も新規は NULL。
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_DECK_ID_RETRIES; attempt++) {
    const publicId = generatePublicId()
    try {
      await withDb(async (client) => {
        await client.query(
          `INSERT INTO decks
            (id, slug, legacy_slug, short_id, title, description, user_id, category,
             original_language, target_languages, file_key, status, is_public)
           VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7, $8, $9, 'pending', false)`,
          [
            params.deckId,
            publicId,
            params.title,
            params.description,
            userId,
            params.category,
            params.originalLanguage,
            JSON.stringify(params.targetLanguages),
            params.fileKey,
          ],
        )
      })
      // 保存は正規形、戻り値には表示形（3-4-3）も含めて呼び出し側で利用できるようにする。
      return { slug: publicId, displaySlug: formatPublicId(publicId) }
    } catch (err) {
      lastErr = err
      if (!isRetryableDeckInsertError(err)) throw err
      // リトライ対象（衝突）の場合は新IDで再試行
    }
  }

  throw new Error(
    `公開識別子の採番に失敗しました（${MAX_DECK_ID_RETRIES}回リトライ後）`,
    { cause: lastErr },
  )
}

export async function enqueueProcessing(params: {
  deckId: string
  fileKey: string
  targetLanguages: string[]
  title: string
  description: string
  category: string
  originalLanguage: string
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // この deck が呼び出しユーザーの所有であることを検証し、
  // SQS に渡す file_key は DB に保存済みの値を使う（クライアント値を信頼しない）。
  const fileKey = await withDb(async (client) => {
    const { rows } = await client.query<{ file_key: string | null }>(
      `SELECT file_key FROM decks
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [params.deckId, userId],
    )
    if (rows.length === 0) throw new Error('Deck not found or unauthorized')
    return rows[0].file_key
  })

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        deck_id: params.deckId,
        file_key: fileKey,
        target_languages: params.targetLanguages,
        title: params.title,
        description: params.description,
        category: params.category,
        original_language: params.originalLanguage,
      }),
    }),
  )
}
