import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { withDb } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const { userId: viewerId } = await auth()

  const row = await withDb(async (client) => {
    const { rows } = await client.query<{ user_id: string; slug: string; is_public: boolean | null }>(
      `SELECT user_id, slug, is_public FROM decks
       WHERE short_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [code],
    )
    return rows[0] ?? null
  }).catch(() => null)

  if (!row) notFound()

  // 非公開デッキは所有者のみ
  if (row.is_public === false && viewerId !== row.user_id) notFound()

  redirect(`/@${row.user_id}/${row.slug}`)
}
