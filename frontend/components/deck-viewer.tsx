'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Languages,
  Maximize2,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeckCard } from '@/components/deck-card'
import {
  type Deck,
  type LanguageCode,
  LANGUAGES,
  formatCount,
  languageLabel,
} from '@/lib/data'
import { cn } from '@/lib/utils'
import { likeDeck } from '@/app/actions/deck'

export function DeckViewer({ deck, related }: { deck: Deck; related: Deck[] }) {
  const available: LanguageCode[] = [...new Set([deck.originalLanguage, ...deck.targetLanguages])]
  const [lang, setLang] = useState<LanguageCode>(deck.originalLanguage)
  const [index, setIndex] = useState(0)
  const [liked, setLiked] = useState(false)
  const [optimisticLikes, setOptimisticLikes] = useState(deck.likes)
  const [isPending, startTransition] = useTransition()
  const [showText, setShowText] = useState(true)

  const slide = deck.slides[index]
  const total = deck.slides.length

  const go = (dir: number) =>
    setIndex((i) => Math.min(Math.max(i + dir, 0), total - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  const slideText = slide?.text?.[lang] ?? slide?.text?.[deck.originalLanguage] ?? slide?.text?.en

  const share = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = deck.shortId ? `${origin}/s/${deck.shortId}` : window.location.href
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Title row */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">{deck.category}</Badge>
            <Badge variant="outline" className="gap-1">
              <Languages className="size-3" />
              {available.length} languages
            </Badge>
          </div>
          <h1 className="text-balance font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {deck.title}
          </h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Viewer column */}
        <div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="relative aspect-[16/10] bg-muted">
              <img
                src={slide?.imageUrl || '/placeholder.svg'}
                alt={`Slide ${index + 1} of ${total}`}
                className="size-full object-contain"
              />
              <button
                onClick={() => go(-1)}
                disabled={index === 0}
                aria-label="Previous slide"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onClick={() => go(1)}
                disabled={index === total - 1}
                aria-label="Next slide"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            {/* Controls bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="size-9" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-16 text-center text-sm font-medium tabular-nums text-foreground">
                  {index + 1} / {total}
                </span>
                <Button variant="outline" size="icon" className="size-9" onClick={() => go(1)} disabled={index === total - 1} aria-label="Next">
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Select value={lang} onValueChange={(v) => setLang(v as LanguageCode)}>
                  <SelectTrigger className="h-9 w-[150px]" aria-label="Reading language">
                    <Languages className="size-4 text-accent" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((code) => (
                      <SelectItem key={code} value={code}>
                        {LANGUAGES.find((l) => l.code === code)?.native ?? code}
                        {code === deck.originalLanguage ? ' (original)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={showText ? 'default' : 'outline'}
                  size="sm"
                  className="h-9"
                  onClick={() => setShowText((s) => !s)}
                >
                  {showText ? 'Hide text' : 'Show text'}
                </Button>
              </div>
            </div>
          </div>

          {/* Translated text panel */}
          {showText && (
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Languages className="size-3.5 text-accent" />
                {languageLabel(lang)}
                {lang !== deck.originalLanguage && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    AI translated
                  </Badge>
                )}
              </div>
              <p className="text-pretty text-lg leading-relaxed text-foreground">
                {slideText || 'No extracted text for this slide.'}
              </p>
            </div>
          )}

          {/* Thumbnails */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              All slides
            </h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {deck.slides.map((s, i) => (
                <button
                  key={s.pageNumber}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={cn(
                    'relative aspect-[16/10] overflow-hidden rounded-md border-2 bg-muted transition',
                    i === index ? 'border-accent' : 'border-transparent hover:border-border',
                  )}
                >
                  <img src={s.imageUrl || '/placeholder.svg'} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                if (liked || isPending) return
                setLiked(true)
                setOptimisticLikes((n) => n + 1)
                startTransition(async () => {
                  try {
                    await likeDeck(deck.id)
                  } catch {
                    setLiked(false)
                    setOptimisticLikes((n) => n - 1)
                    toast.error('Failed to like')
                  }
                })
              }}
              variant={liked ? 'default' : 'outline'}
              disabled={isPending}
              className="flex-1 gap-2"
            >
              <Heart className={cn('size-4', liked && 'fill-current')} />
              {formatCount(optimisticLikes)}
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={share}>
              <Share2 className="size-4" />
              Share
            </Button>
          </div>

          {/* Author */}
          <div className="rounded-xl border border-border bg-card p-5">
            <Link href={`/@${deck.author.username}`} className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarImage src={deck.author.avatarUrl || '/placeholder.svg'} alt="" />
                <AvatarFallback>{deck.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading font-semibold text-foreground">
                  {deck.author.name}
                </p>
              </div>
            </Link>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
              {deck.description}
            </p>
            <dl className="mt-4 flex items-center gap-5 border-t border-border pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Heart className="size-4" />
                {formatCount(optimisticLikes)}
              </div>
              <div className="flex items-center gap-1.5">
                <Maximize2 className="size-4" />
                {deck.slideCount} slides
              </div>
            </dl>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {deck.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/browse?q=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border px-3 py-1 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  {tag}
                </Link>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Published</p>
              <p className="text-sm text-foreground">
                {new Date(deck.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-heading text-2xl font-bold tracking-tight text-foreground">
            More like this
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((d) => (
              <DeckCard key={d.id} deck={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
