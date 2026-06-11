'use server'

import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
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

const LIKED_COOKIE = 'liked_decks'
const LIKED_MAX = 500

export async function likeDeck(deckId: string): Promise<{ alreadyLiked: boolean }> {
  const cookieStore = await cookies()

  // 同一ブラウザ（未認証含む）が同じデッキに複数回いいねするのを防止
  let liked: string[] = []
  const raw = cookieStore.get(LIKED_COOKIE)?.value
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) liked = parsed.filter((v) => typeof v === 'string')
    } catch {
      liked = []
    }
  }

  if (liked.includes(deckId)) {
    return { alreadyLiked: true }
  }

  const { rowCount } = await withDb(async (client) =>
    client.query(
      `UPDATE decks SET likes = likes + 1 WHERE id = $1 AND deleted_at IS NULL`,
      [deckId],
    ),
  )
  if (!rowCount) throw new Error('Deck not found')

  liked.push(deckId)
  if (liked.length > LIKED_MAX) liked = liked.slice(-LIKED_MAX)

  cookieStore.set(LIKED_COOKIE, JSON.stringify(liked), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return { alreadyLiked: false }
}

export async function hasLikedDeck(deckId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(LIKED_COOKIE)?.value
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.includes(deckId)
  } catch {
    return false
  }
}
