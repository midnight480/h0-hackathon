import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { withDb } from '@/lib/db'
import { resolveViewerId } from '@/lib/viewer-id'

const DECK_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// デッキのユニーク視聴を記録する。
// - viewer_id: 認証済みは Clerk user_id、匿名はボディの UUID を anon: 形式で使用
// - deck_views の複合主キーで同一視聴者の重複を排除し、新規視聴のみ decks.views を +1
// - 所有者自身の閲覧・非公開デッキへの非所有者アクセスはカウントしない
// - 計測はクライアント（ViewTracker）からのみ行われるため、OGP クローラー等の
//   サーバー側レンダリングや JS 非実行 Bot はカウントされない
export async function POST(
  req: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const { deckId } = await params
  if (!DECK_ID_RE.test(deckId)) {
    return NextResponse.json({ error: 'invalid deck id' }, { status: 400 })
  }

  const { userId } = await auth()
  let body: { viewerId?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // 空ボディは匿名 ID 欠落として扱う
  }

  const viewerId = resolveViewerId(userId, body.viewerId)
  if (!viewerId) {
    return NextResponse.json({ error: 'invalid viewer' }, { status: 400 })
  }

  try {
    const result = await withDb(async (client) => {
      const { rows } = await client.query<{
        user_id: string
        is_public: boolean | null
      }>(
        `SELECT user_id, is_public FROM decks
         WHERE id = $1 AND deleted_at IS NULL`,
        [deckId],
      )
      const deck = rows[0]
      // 非公開デッキは所有者以外に存在を漏らさない
      if (!deck || (deck.is_public === false && userId !== deck.user_id)) {
        return 'not_found' as const
      }
      // 所有者自身の閲覧はカウントしない
      if (userId === deck.user_id) return 'skipped' as const

      try {
        await client.query('BEGIN')
        await client.query(
          `INSERT INTO deck_views (deck_id, viewer_id) VALUES ($1, $2)`,
          [deckId, viewerId],
        )
        await client.query(
          `UPDATE decks SET views = views + 1 WHERE id = $1 AND deleted_at IS NULL`,
          [deckId],
        )
        await client.query('COMMIT')
        return 'counted' as const
      } catch (e) {
        await client.query('ROLLBACK')
        // 23505 = unique_violation（既視聴）
        if ((e as { code?: string }).code === '23505') return 'skipped' as const
        throw e
      }
    })

    if (result === 'not_found') {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ counted: result === 'counted' })
  } catch {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
