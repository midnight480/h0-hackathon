import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { isCanonicalId, normalizePublicId, formatPublicId } from '@/lib/public-id'
import { isUserId, normalizeUsername } from '@/lib/username'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SlideTextEditor, type EditableSlide } from '@/components/slide-text-editor'
import type { SlideBlock } from '@/lib/data'
import { withDb } from '@/lib/db'

// 抽出/OCR 済みテキストを所有者が訂正するための編集ページ。
// `/@{user}/{slug}/edit`（正規 slug のみ対象。旧URLは閲覧ページ側で正規化される）。
export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ user: string; slug: string }>
}) {
  const { user, slug } = await params
  const { userId } = await auth()
  if (!userId) notFound()

  const raw = decodeURIComponent(user).replace(/^@/, '')
  const normalized = normalizePublicId(slug)
  if (!isCanonicalId(normalized)) notFound()

  const ownerColumn = isUserId(raw) ? 'user_id' : 'username'
  const ownerValue = isUserId(raw) ? raw : normalizeUsername(raw)

  const result = await withDb(async (client) => {
    const { rows: deckRows } = await client.query<{
      id: string
      user_id: string
      title: string
      status: string
    }>(
      `SELECT id, user_id, title, status FROM decks
       WHERE ${ownerColumn} = $1 AND slug = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [ownerValue, normalized],
    )
    const deck = deckRows[0]
    // 所有者以外には存在自体を隠す
    if (!deck || deck.user_id !== userId) return null

    const { rows: slideRows } = await client.query<{
      id: string
      page_number: number
      image_key: string | null
      layout: unknown
      language_code: string | null
      content: string | null
    }>(
      `SELECT s.id, s.page_number, s.image_key, s.layout,
              st.language_code, st.content
       FROM slides s
       LEFT JOIN slide_texts st ON st.slide_id = s.id AND st.language_code = 'original'
       WHERE s.deck_id = $1
       ORDER BY s.page_number`,
      [deck.id],
    )
    return { deck, slideRows }
  })
  if (!result) notFound()

  const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
  const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`

  const slides: EditableSlide[] = result.slideRows.map((row) => {
    let layout: SlideBlock[] = []
    try {
      const arr = typeof row.layout === 'string' ? JSON.parse(row.layout) : row.layout
      layout = Array.isArray(arr) ? (arr as SlideBlock[]) : []
    } catch {
      layout = []
    }
    return {
      slideId: row.id,
      pageNumber: row.page_number,
      imageUrl: row.image_key ? `${s3Base}/${row.image_key}` : '/placeholder.svg',
      originalText: row.content ?? '',
      blockTexts: layout.map((b) => b.t.original ?? ''),
    }
  })

  const backHref = `/@${raw}/${formatPublicId(normalized)}`

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <SlideTextEditor
          deckId={result.deck.id}
          deckTitle={result.deck.title}
          backHref={backHref}
          slides={slides}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
