'use server'

import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { randomUUID } from 'crypto'
import { withDb } from '@/lib/db'
import { isBotUserAgent } from '@/lib/bot'
import { CONSENT_COOKIE } from '@/lib/consent'
import { type ViewContext, classifySource } from '@/lib/referrer'

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

// デッキ閲覧を 1 件記録する。
// - deck_view_events: 閲覧ごとのイベント（日別推移・流入元の分析用）を毎回 INSERT
// - deck_views / decks.views: 閲覧者ごとに初回のみ加算（一覧に出すトータルのユニーク View 数）
// クライアント（DeckViewer のマウント時 beacon）から呼ばれるため、JS を実行しないクローラーは計上されない。
// 除外条件: Cookie 同意なし / Bot UA / 所有者自身の閲覧 / 非公開デッキ / 削除済みデッキ。
export async function recordDeckView(
  deckId: string,
  ctx: ViewContext = {},
): Promise<{ counted: boolean }> {
  // Cookie 同意（閲覧分析）が無い場合は識別子の発行も記録も行わない
  if ((await cookies()).get(CONSENT_COOKIE)?.value !== 'granted') return { counted: false }

  const h = await headers()
  if (isBotUserAgent(h.get('user-agent'))) return { counted: false }

  const viewerId = await resolveLikerId(true)
  if (!viewerId) return { counted: false }

  const selfHost = h.get('x-forwarded-host') ?? h.get('host')
  // クライアント入力はサイズを制限した上で分類する（任意文字列をそのまま保存しない）
  const { source, host } = classifySource(
    {
      referrer: typeof ctx.referrer === 'string' ? ctx.referrer.slice(0, 2048) : null,
      utmSource: typeof ctx.utmSource === 'string' ? ctx.utmSource.slice(0, 64) : null,
      hasFbclid: ctx.hasFbclid === true,
      clientNavigation: ctx.clientNavigation === true,
    },
    selfHost ? selfHost.split(':')[0] : null,
  )

  try {
    return await withDb(async (client) => {
      const { rows } = await client.query<{ user_id: string; is_public: boolean | null }>(
        `SELECT user_id, is_public FROM decks WHERE id = $1 AND deleted_at IS NULL`,
        [deckId],
      )
      const deck = rows[0]
      if (!deck || deck.is_public === false || deck.user_id === viewerId) {
        return { counted: false }
      }

      // イベントはユニーク判定（一意制約違反で ROLLBACK され得る）と別トランザクションで記録する
      await client.query(
        `INSERT INTO deck_view_events (deck_id, viewer_id, source, referrer_host) VALUES ($1, $2, $3, $4)`,
        [deckId, viewerId, source, host ? host.slice(0, 255) : null],
      )

      try {
        await client.query('BEGIN')
        try {
          // 複合主キー (deck_id, viewer_id) により同一閲覧者の再訪は一意制約違反になる
          await client.query(
            `INSERT INTO deck_views (deck_id, viewer_id) VALUES ($1, $2)`,
            [deckId, viewerId],
          )
          await client.query(
            `UPDATE decks SET views = views + 1 WHERE id = $1 AND deleted_at IS NULL`,
            [deckId],
          )
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        }
      } catch (e) {
        // 23505 = unique_violation（既に閲覧済み → トータルは加算しない）
        if ((e as { code?: string }).code === '23505') return { counted: false }
        throw e
      }
      return { counted: true }
    })
  } catch (e) {
    // DSQL の OCC 競合等も閲覧体験を妨げないよう握りつぶし、未計上として返す
    console.error('recordDeckView failed', e)
    return { counted: false }
  }
}
