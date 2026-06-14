import { permanentRedirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { withDb } from '@/lib/db'
import { formatPublicId } from '@/lib/public-id'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const { userId: viewerId } = await auth()

  const row = await withDb(async (client) => {
    const { rows } = await client.query<{ user_id: string; username: string | null; slug: string; is_public: boolean | null }>(
      `SELECT user_id, username, slug, is_public FROM decks
       WHERE short_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [code],
    )
    return rows[0] ?? null
  }).catch(() => null)

  if (!row) notFound()

  // 非公開デッキは所有者のみ
  if (row.is_public === false && viewerId !== row.user_id) notFound()

  // レガシー短縮URL（/s/{code}）は新URL形式（公開識別子の表示形 3-4-3）へ恒久リダイレクト（BR-6: 301相当）。
  // 著者識別子は username（無ければ user_id へフォールバック）を用いる。
  permanentRedirect(`/@${row.username ?? row.user_id}/${formatPublicId(row.slug)}`)
}
