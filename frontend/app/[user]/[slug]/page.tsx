import { notFound, permanentRedirect } from 'next/navigation'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { normalizePublicId, isCanonicalId, formatPublicId } from '@/lib/public-id'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { DeckViewer } from '@/components/deck-viewer'
import { type Deck, type Slide, type LanguageCode } from '@/lib/data'
import { withDb } from '@/lib/db'
import { getClerkUsers } from '@/lib/clerk-users'
import { hasLikedDeck } from '@/app/actions/deck'

async function getAuthorInfo(userId: string) {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      userId
    return { name, avatarUrl: user.imageUrl ?? '' }
  } catch {
    return { name: userId, avatarUrl: '' }
  }
}

async function getDeckFromDb(
  userId: string,
  slug: string,
  viewerId: string | null,
  authorInfo?: { name: string; avatarUrl: string },
): Promise<Deck | null> {
  try {
    return await withDb(async (client) => {
      const { rows } = await client.query<{
        id: string
        slug: string
        short_id: string | null
        title: string
        description: string
        user_id: string
        category: string
        original_language: string
        target_languages: string[] | string
        slide_count: number
        views: number
        likes: number
        status: string
        is_public: boolean | null
        cover_image_key: string | null
        published_at: string
      }>(
        `SELECT id, slug, short_id, title, description, user_id, category, original_language,
                target_languages, slide_count, views, likes, status, is_public, cover_image_key, published_at
         FROM decks
         WHERE user_id = $1 AND slug = $2 AND deleted_at IS NULL`,
        [userId, slug],
      )
      if (rows.length === 0) return null
      const d = rows[0]

      // 非公開（is_public = false）のデッキは所有者のみ閲覧可能
      if (d.is_public === false && viewerId !== d.user_id) return null

      const { rows: slideRows } = await client.query<{
        page_number: number
        image_key: string | null
        language_code: string | null
        content: string | null
      }>(
        `SELECT s.page_number, s.image_key, st.language_code, st.content
         FROM slides s
         LEFT JOIN slide_texts st ON st.slide_id = s.id
         WHERE s.deck_id = $1
         ORDER BY s.page_number`,
        [d.id],
      )

      const slideMap = new Map<number, { imageKey: string | null; texts: Record<string, string> }>()
      for (const row of slideRows) {
        if (!slideMap.has(row.page_number)) {
          slideMap.set(row.page_number, { imageKey: row.image_key, texts: {} })
        }
        if (row.language_code && row.content) {
          slideMap.get(row.page_number)!.texts[row.language_code] = row.content
        }
      }

      const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
      const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
      const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`

      const slides: Slide[] = Array.from(slideMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([pageNumber, { imageKey, texts }]) => ({
          pageNumber,
          imageUrl: imageKey ? `${s3Base}/${imageKey}` : '/placeholder.svg',
          text: texts as Partial<Record<LanguageCode, string>>,
        }))

      const targetLanguages = Array.isArray(d.target_languages)
        ? d.target_languages
        : JSON.parse(d.target_languages as string)

      return {
        id: d.id,
        slug: d.slug,
        shortId: d.short_id ?? undefined,
        title: d.title,
        description: d.description,
        author: { username: d.user_id, name: authorInfo?.name ?? d.user_id, avatarUrl: authorInfo?.avatarUrl ?? '' },
        category: d.category as Deck['category'],
        tags: [],
        originalLanguage: d.original_language as LanguageCode,
        targetLanguages: targetLanguages as LanguageCode[],
        slideCount: d.slide_count,
        views: d.views,
        likes: d.likes,
        status: d.status as Deck['status'],
        publishedAt: d.published_at,
        cover: d.cover_image_key ? `${s3Base}/${d.cover_image_key}` : '/placeholder.svg',
        slides,
      }
    })
  } catch {
    return null
  }
}

// レガシー slug（旧タイトル由来URL）から現在の正規形 slug を引く。
// 見つかれば新URLへリダイレクトするために使用する。
async function getCanonicalSlugByLegacy(
  userId: string,
  legacySlug: string,
): Promise<string | null> {
  try {
    return await withDb(async (client) => {
      const { rows } = await client.query<{ slug: string }>(
        `SELECT slug FROM decks
         WHERE user_id = $1 AND legacy_slug = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [userId, legacySlug],
      )
      return rows[0]?.slug ?? null
    })
  } catch {
    return null
  }
}

async function fetchRelated(deckId: string, category: string): Promise<Deck[]> {
  try {
    const rows = await withDb(async (client) => {
      const { rows } = await client.query<{
        id: string; slug: string; title: string; description: string
        user_id: string; category: string; original_language: string
        target_languages: string[] | string; slide_count: number
        views: number; likes: number; cover_image_key: string | null; published_at: string
      }>(
        `SELECT id, slug, title, description, user_id, category, original_language,
                target_languages, slide_count, views, likes, cover_image_key, published_at
         FROM decks
         WHERE id != $1 AND category = $2
           AND status = 'ready'
           AND (is_public = true OR is_public IS NULL)
           AND deleted_at IS NULL
         ORDER BY views DESC
         LIMIT 3`,
        [deckId, category],
      )
      return rows
    })
    const userMap = await getClerkUsers(rows.map((r) => r.user_id))
    const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
    const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`
    return rows.map((r) => {
      const author = userMap.get(r.user_id) ?? { name: r.user_id, avatarUrl: '' }
      const targetLanguages = Array.isArray(r.target_languages)
        ? r.target_languages : JSON.parse(r.target_languages as string)
      return {
        id: r.id, slug: r.slug, title: r.title, description: r.description,
        author: { username: r.user_id, name: author.name, avatarUrl: author.avatarUrl },
        category: r.category as Deck['category'], tags: [],
        originalLanguage: r.original_language as LanguageCode,
        targetLanguages: targetLanguages as LanguageCode[],
        slideCount: r.slide_count, views: r.views, likes: r.likes,
        status: 'ready' as const, publishedAt: r.published_at,
        cover: r.cover_image_key ? `${s3Base}/${r.cover_image_key}` : '/placeholder.svg',
        slides: [],
      }
    })
  } catch {
    return []
  }
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ user: string; slug: string }>
}) {
  const { user, slug } = await params
  const username = decodeURIComponent(user).replace(/^@/, '')

  const { userId: viewerId } = await auth()
  const authorInfo = await getAuthorInfo(username)

  // 公開識別子を正規化（ハイフン除去・小文字化）。正規形なら slug で検索する。
  // 例: `abc-defg-hij` も `abcdefghij` も同一デッキに解決する。
  const normalized = normalizePublicId(slug)
  let deck: Deck | null = null
  if (isCanonicalId(normalized)) {
    deck = await getDeckFromDb(username, normalized, viewerId, authorInfo)
  }

  // 未ヒット時はレガシー slug（旧タイトルURL）として検索し、新URLへリダイレクト（301相当）。
  if (!deck) {
    const canonical = await getCanonicalSlugByLegacy(username, slug)
    if (canonical) {
      // 旧タイトルURL → 新URLへ恒久リダイレクト（BR-5: 301相当）
      permanentRedirect(`/@${username}/${formatPublicId(canonical)}`)
    }
    notFound()
  }

  // スライドがまだない（pending/processing/failed）場合は処理中ページを表示
  if (deck.slides.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="font-heading text-lg font-semibold text-foreground">{deck.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {deck.status === 'failed'
                ? 'Processing failed. Please try uploading again.'
                : 'This deck is still being processed. Check back shortly.'}
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const related = await fetchRelated(deck.id, deck.category)
  const initialLiked = await hasLikedDeck(deck.id)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <DeckViewer deck={deck} related={related} initialLiked={initialLiked} />
      </main>
      <SiteFooter />
    </div>
  )
}
