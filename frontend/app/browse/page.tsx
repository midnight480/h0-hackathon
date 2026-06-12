import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { BrowseInner } from '@/components/browse-inner'
import { withDb } from '@/lib/db'
import { getClerkUsers } from '@/lib/clerk-users'
import { type Deck, type LanguageCode, LANGUAGES } from '@/lib/data'

async function fetchDecks(): Promise<Deck[]> {
  try {
    const rows = await withDb(async (client) => {
      const { rows } = await client.query<{
        id: string
        slug: string
        title: string
        description: string
        user_id: string
        category: string
        original_language: string
        target_languages: string[] | string
        slide_count: number
        views: number
        likes: number
        cover_image_key: string | null
        published_at: string
      }>(
        `SELECT id, slug, title, description, user_id, category, original_language,
                target_languages, slide_count, views, likes, cover_image_key, published_at
         FROM decks
         WHERE status = 'ready'
           AND (is_public = true OR is_public IS NULL)
           AND deleted_at IS NULL
         ORDER BY views DESC`,
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
        ? r.target_languages
        : JSON.parse(r.target_languages as string)
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        author: { username: r.user_id, name: author.name, avatarUrl: author.avatarUrl },
        category: r.category as Deck['category'],
        tags: [],
        originalLanguage: r.original_language as LanguageCode,
        targetLanguages: targetLanguages as LanguageCode[],
        slideCount: r.slide_count,
        views: r.views,
        likes: r.likes,
        status: 'ready' as const,
        publishedAt: r.published_at,
        cover: r.cover_image_key ? `${s3Base}/${r.cover_image_key}` : '/placeholder.svg',
        slides: [],
      }
    })
  } catch {
    return []
  }
}

export default async function BrowsePage() {
  const decks = await fetchDecks()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={null}>
          <BrowseInner decks={decks} totalLanguages={LANGUAGES.length} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
