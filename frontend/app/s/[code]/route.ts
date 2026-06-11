import { redirect, notFound } from 'next/navigation'
import { withDb } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params

  const row = await withDb(async (client) => {
    const { rows } = await client.query<{ user_id: string; slug: string }>(
      `SELECT user_id, slug FROM decks
       WHERE short_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [code],
    )
    return rows[0] ?? null
  }).catch(() => null)

  if (!row) notFound()

  redirect(`/@${row.user_id}/${row.slug}`)
}
