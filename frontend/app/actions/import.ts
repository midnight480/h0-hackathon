'use server'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits'
import { parseGoogleSlidesPresentationId } from '@/lib/gslides'

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files'
const FETCH_TIMEOUT_MS = 30_000
// Google Slides ネイティブ形式のみ export/pdf 相当（mimeType=application/pdf）で取得可能。
// アップロード済み PDF 等のバイナリファイルは本機能の対象外（通常アップロード導線を使う）。
const GSLIDES_MIME = 'application/vnd.google-apps.presentation'

export type ImportErrorCode =
  | 'unavailable' // GOOGLE_API_KEY 未設定
  | 'invalidUrl' // Google Slides の URL 形式でない
  | 'notGoogleSlides' // Drive 上のファイルが Google スライドではない
  | 'restricted' // 「リンクを知っている全員」になっていない
  | 'notPdf' // エクスポート結果が PDF でない
  | 'tooLarge' // MAX_UPLOAD_BYTES 超過
  | 'fetchFailed' // その他の取得失敗

export type ImportResult =
  | { ok: true; deckId: string; fileKey: string; suggestedTitle: string }
  | { ok: false; code: ImportErrorCode }

// Google Slides 共有 URL から Drive API files.export 経由で PDF を取得し、
// 通常アップロードと同じ `uploads/{deckId}/` 配下に保存する。
// 戻り値はクライアント側で i18n エラーメッセージへマップする判別共用体。
export async function importFromGoogleSlides(rawUrl: string): Promise<ImportResult> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { ok: false, code: 'unavailable' }

  const fileId = parseGoogleSlidesPresentationId(rawUrl)
  if (!fileId) return { ok: false, code: 'invalidUrl' }

  // 1. ファイルメタデータ取得（存在・共有設定の検証とタイトル既定値用）
  const metaRes = await fetch(
    `${DRIVE_API_BASE}/${encodeURIComponent(fileId)}?fields=name,mimeType&key=${apiKey}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' },
  ).catch(() => null)
  if (!metaRes) return { ok: false, code: 'fetchFailed' }
  if (metaRes.status === 403 || metaRes.status === 404) {
    return { ok: false, code: 'restricted' }
  }
  if (!metaRes.ok) return { ok: false, code: 'fetchFailed' }

  const meta = (await metaRes.json().catch(() => null)) as {
    name?: string
    mimeType?: string
  } | null
  if (!meta || meta.mimeType !== GSLIDES_MIME) {
    return { ok: false, code: 'notGoogleSlides' }
  }

  // 2. PDF エクスポート（「リンクを知っている全員」以上の共有が必要）
  const exportRes = await fetch(
    `${DRIVE_API_BASE}/${encodeURIComponent(fileId)}/export?mimeType=application/pdf&key=${apiKey}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' },
  ).catch(() => null)
  if (!exportRes) return { ok: false, code: 'fetchFailed' }
  if (exportRes.status === 403 || exportRes.status === 404) {
    return { ok: false, code: 'restricted' }
  }
  if (!exportRes.ok) return { ok: false, code: 'fetchFailed' }

  const contentLength = Number(exportRes.headers.get('content-length') ?? 0)
  if (contentLength > MAX_UPLOAD_BYTES) return { ok: false, code: 'tooLarge' }

  const body = new Uint8Array(await exportRes.arrayBuffer())
  if (body.length > MAX_UPLOAD_BYTES) return { ok: false, code: 'tooLarge' }

  // 3. マジックバイト検証（HTML エラーページ等を PDF として保存しない）
  const magic = new TextDecoder().decode(body.subarray(0, 5))
  if (magic !== '%PDF-') return { ok: false, code: 'notPdf' }

  // 4. 通常アップロードと同じ `uploads/{deckId}/` 配下に保存。
  //    createDeckRecord の fileKey プレフィックス検証と整合する。
  const deckId = randomUUID()
  const fileKey = `uploads/${deckId}/imported.pdf`
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: fileKey,
      Body: body,
      ContentType: 'application/pdf',
    }),
  )

  return {
    ok: true,
    deckId,
    fileKey,
    suggestedTitle: meta.name ?? '',
  }
}
