import Link from 'next/link'
import { ArrowRight, Globe, Heart, Sparkles, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { HeroSearch } from '@/components/hero-search'
import { DeckCard } from '@/components/deck-card'
import { Badge } from '@/components/ui/badge'
import { CATEGORIES, LANGUAGES, type Deck, type LanguageCode, formatCount } from '@/lib/data'
import { withDb } from '@/lib/db'
import { getClerkUsers } from '@/lib/clerk-users'

async function fetchFeatured(): Promise<{ decks: Deck[]; totalDecks: number; totalLikes: number }> {
  try {
    const { rows, totalDecks, totalLikes } = await withDb(async (client) => {
      const { rows } = await client.query<{
        id: string; slug: string; title: string; description: string
        user_id: string; category: string; original_language: string
        target_languages: string[] | string; slide_count: number
        views: number; likes: number; cover_image_key: string | null; published_at: string
      }>(
        `SELECT id, slug, title, description, user_id, category, original_language,
                target_languages, slide_count, views, likes, cover_image_key, published_at
         FROM decks
         WHERE status = 'ready'
           AND (is_public = true OR is_public IS NULL)
           AND deleted_at IS NULL
         ORDER BY views DESC
         LIMIT 6`,
      )
      const stats = await client.query<{ total_decks: string; total_likes: string }>(
        `SELECT COUNT(*) AS total_decks, COALESCE(SUM(likes), 0) AS total_likes
         FROM decks WHERE status = 'ready' AND (is_public = true OR is_public IS NULL) AND deleted_at IS NULL`,
      )
      return {
        rows,
        totalDecks: Number(stats.rows[0]?.total_decks ?? 0),
        totalLikes: Number(stats.rows[0]?.total_likes ?? 0),
      }
    })

    const userMap = await getClerkUsers(rows.map((r) => r.user_id))
    const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME ?? ''
    const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`

    const decks: Deck[] = rows.map((r) => {
      const author = userMap.get(r.user_id) ?? { name: r.user_id, avatarUrl: '' }
      const targetLanguages = Array.isArray(r.target_languages)
        ? r.target_languages
        : JSON.parse(r.target_languages as string)
      return {
        id: r.id, slug: r.slug, title: r.title, description: r.description,
        author: { username: r.user_id, name: author.name, avatarUrl: author.avatarUrl },
        category: r.category as Deck['category'],
        tags: [],
        originalLanguage: r.original_language as LanguageCode,
        targetLanguages: targetLanguages as LanguageCode[],
        slideCount: r.slide_count, views: r.views, likes: r.likes,
        status: 'ready' as const, publishedAt: r.published_at,
        cover: r.cover_image_key ? `${s3Base}/${r.cover_image_key}` : '/placeholder.svg',
        slides: [],
      }
    })

    return { decks, totalDecks, totalLikes }
  } catch {
    return { decks: [], totalDecks: 0, totalLikes: 0 }
  }
}

export default async function HomePage() {
  const { decks, totalDecks, totalLikes } = await fetchFeatured()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--accent)/0.08),transparent)]" />
          <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
            <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full px-3 py-1">
              <Sparkles className="size-3.5 text-accent" />
              Instant AI translation for every deck
            </Badge>
            <h1 className="max-w-3xl text-balance font-heading text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Great ideas shouldn&apos;t stop at a language border
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Hiravi lets you upload a slide deck once and share it in every
              language. Read any talk in your own tongue, instantly.
            </p>
            <div className="mt-10 flex w-full flex-col items-center gap-4">
              <HeroSearch />
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Categories:</span>
                {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                  <Link
                    key={c.value}
                    href={`/browse?category=${c.value}`}
                    className="rounded-full border border-border bg-card px-3 py-1 transition-colors hover:border-accent hover:text-accent"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>

            <dl className="mt-14 grid w-full max-w-2xl grid-cols-3 gap-4">
              {[
                { icon: Globe, label: 'Supported Languages', value: `${LANGUAGES.length}` },
                { icon: Zap, label: 'Decks', value: `${totalDecks}` },
                { icon: Heart, label: 'Likes', value: formatCount(totalLikes) },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center rounded-xl border border-border bg-card p-5"
                >
                  <s.icon className="mb-2 size-5 text-accent" />
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </dt>
                  <dd className="font-heading text-2xl font-semibold text-foreground">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { step: '01', title: 'Upload your PDF', body: 'Drop in any slide deck. We extract the text from every page automatically.' },
                { step: '02', title: 'We translate it', body: 'Each slide is translated into your chosen languages while we render crisp previews.' },
                { step: '03', title: 'Share worldwide', body: 'Readers pick their language and follow along — no copy-paste, no friction.' },
              ].map((s) => (
                <div key={s.step} className="flex flex-col gap-3">
                  <span className="font-heading text-sm font-semibold text-accent">{s.step}</span>
                  <h3 className="font-heading text-xl font-semibold text-foreground">{s.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                Featured decks
              </h2>
              <p className="mt-1 text-muted-foreground">
                Popular talks from creators around the world.
              </p>
            </div>
            <Link
              href="/browse"
              className="group flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              Browse all
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mb-8 flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
              <Link
                key={c.value}
                href={`/browse?category=${c.value}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                {c.label}
              </Link>
            ))}
          </div>

          {decks.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No decks yet. Be the first to upload!</p>
          )}
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-foreground text-background">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 lg:px-8">
            <h2 className="max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Your next talk deserves a global audience
            </h2>
            <p className="max-w-lg text-pretty leading-relaxed text-background/70">
              Upload a deck and watch it reach readers who never could have read it before.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-medium text-accent-foreground transition-transform hover:scale-[1.02]"
            >
              Upload your first deck
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
