'use server'

import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { withDb } from '@/lib/db'

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })

export async function deleteDeck(deckId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const { fileKey, coverKey, slideKeys } = await withDb(async (client) => {
    const { rows } = await client.query<{ file_key: string | null; cover_image_key: string | null }>(
      `SELECT file_key, cover_image_key FROM decks
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [deckId, userId],
    )
    if (rows.length === 0) throw new Error('Deck not found or unauthorized')

    const { rows: slides } = await client.query<{ image_key: string | null }>(
      `SELECT image_key FROM slides WHERE deck_id = $1`,
      [deckId],
    )

    return {
      fileKey: rows[0].file_key,
      coverKey: rows[0].cover_image_key,
      slideKeys: slides.map((s) => s.image_key).filter(Boolean) as string[],
    }
  })

  const keysToDelete = [fileKey, coverKey, ...slideKeys].filter(Boolean) as string[]
  if (keysToDelete.length > 0 && process.env.S3_BUCKET_NAME) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Delete: {
          Objects: keysToDelete.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    )
  }

  await withDb(async (client) => {
    await client.query(
      `UPDATE decks SET deleted_at = NOW() WHERE id = $1 AND user_id = $2`,
      [deckId, userId],
    )
  })

  revalidatePath('/dashboard')
}

export async function toggleVisibility(deckId: string, isPublic: boolean) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  await withDb(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE decks SET is_public = $1 WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
      [isPublic, deckId, userId],
    )
    if (!rowCount) throw new Error('Deck not found or unauthorized')
  })

  revalidatePath('/dashboard')
}

const ANON_COOKIE = 'anon_id'

// いいねの主体を識別する ID を返す。
// 認証済みユーザーは Clerk の user_id、未認証は Cookie に保存した anon ID。
// 未認証で anon ID が無い場合は新規発行して Cookie に保存する（Server Action 内でのみ可能）。
async function resolveLikerId(allowCreate: boolean): Promise<string | null> {
  const { userId } = await auth()
  if (userId) return userId

  const cookieStore = await cookies()
  const existing = cookieStore.get(ANON_COOKIE)?.value
  if (existing) return existing
  if (!allowCreate) return null

  const anon = `anon:${randomUUID()}`
  cookieStore.set(ANON_COOKIE, anon, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return anon
}

export async function likeDeck(deckId: string): Promise<{ alreadyLiked: boolean }> {
  const likerId = await resolveLikerId(true)
  if (!likerId) throw new Error('Could not resolve liker')

  try {
    await withDb(async (client) => {
      await client.query('BEGIN')
      try {
        // 複合主キー (deck_id, liker_id) により重複いいねは一意制約違反になる
        await client.query(
          `INSERT INTO deck_likes (deck_id, liker_id) VALUES ($1, $2)`,
          [deckId, likerId],
        )
        const { rowCount } = await client.query(
          `UPDATE decks SET likes = likes + 1 WHERE id = $1 AND deleted_at IS NULL`,
          [deckId],
        )
        if (!rowCount) throw new Error('Deck not found')
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    })
  } catch (e) {
    // 23505 = unique_violation（既にいいね済み）
    if ((e as { code?: string }).code === '23505') {
      return { alreadyLiked: true }
    }
    throw e
  }

  return { alreadyLiked: false }
}

export async function hasLikedDeck(deckId: string): Promise<boolean> {
  // Server Component から呼ばれるため Cookie は新規発行しない（読み取りのみ）
  const likerId = await resolveLikerId(false)
  if (!likerId) return false

  return withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM deck_likes WHERE deck_id = $1 AND liker_id = $2 LIMIT 1`,
      [deckId, likerId],
    )
    return rows.length > 0
  }).catch(() => false)
}
