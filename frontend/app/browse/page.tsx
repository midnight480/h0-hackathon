'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { DeckCard } from '@/components/deck-card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DECKS,
  CATEGORIES,
  LANGUAGES,
  type Category,
  type LanguageCode,
} from '@/lib/data'
import { cn } from '@/lib/utils'

type Sort = 'trending' | 'recent' | 'liked'

function BrowseInner() {
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState<Category | 'all'>(
    (params.get('category') as Category) ?? 'all',
  )
  const [language, setLanguage] = useState<LanguageCode | 'all'>('all')
  const [sort, setSort] = useState<Sort>('trending')

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = DECKS.filter((d) => {
      if (category !== 'all' && d.category !== category) return false
      if (
        language !== 'all' &&
        d.originalLanguage !== language &&
        !d.targetLanguages.includes(language)
      )
        return false
      if (!query) return true
      return (
        d.title.toLowerCase().includes(query) ||
        d.description.toLowerCase().includes(query) ||
        d.author.name.toLowerCase().includes(query) ||
        d.tags.some((t) => t.toLowerCase().includes(query))
      )
    })

    list = [...list].sort((a, b) => {
      if (sort === 'liked') return b.likes - a.likes
      if (sort === 'recent')
        return +new Date(b.publishedAt) - +new Date(a.publishedAt)
      return b.views - a.views
    })
    return list
  }, [q, category, language, sort])

  return (
    <>
      {/* Page heading + search */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Browse decks
          </h1>
          <p className="mt-1 text-muted-foreground">
            Explore {DECKS.length} talks across {LANGUAGES.length} languages.
          </p>
          <div className="relative mt-6 max-w-lg">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search talks, topics, or authors…"
              aria-label="Search slide decks"
              className="h-12 rounded-lg bg-card pl-11"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="-mb-px flex flex-1 flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  category === c.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v as LanguageCode | 'all')}
            >
              <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by language">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.native}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="h-9 w-[130px]" aria-label="Sort decks">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trending">Trending</SelectItem>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="liked">Most liked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="mb-6 text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? 'result' : 'results'}
          {q.trim() && (
            <>
              {' '}for <span className="font-medium text-foreground">{q.trim()}</span>
            </>
          )}
        </p>

        {results.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <Search className="mb-3 size-8 text-muted-foreground" />
            <p className="font-heading text-lg font-semibold text-foreground">
              No decks found
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or clear your filters.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default function BrowsePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={null}>
          <BrowseInner />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
