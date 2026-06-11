import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Heart,
  Layers,
  Loader2,
  Plus,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DeckDeleteButton } from '@/components/deck-delete-button'
import { DeckVisibilityToggle } from '@/components/deck-visibility-toggle'
import { withDb } from '@/lib/db'
import { type ProcessingStatus, formatCount, languageLabel } from '@/lib/data'
import { cn } from '@/lib/utils'

interface DeckRow {
  id: string
  slug: string
  title: string
  original_language: string
  target_languages: string[]
  slide_count: number
  views: number
  likes: number
  status: ProcessingStatus
  cover_image_key: string | null
  published_at: string
  is_public: boolean | null
}

const STATUS: Record<
  ProcessingStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  ready: {
    label: 'Published',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  processing: {
    label: 'Translating',
    icon: Loader2,
    className: 'bg-accent/10 text-accent',
  },
  pending: {
    label: 'Queued',
    icon: Clock,
    className: 'bg-muted text-muted-foreground',
  },
  failed: {
    label: 'Failed',
    icon: AlertTriangle,
    className: 'bg-destructive/10 text-destructive',
  },
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        s.className,
      )}
    >
      <Icon className={cn('size-3.5', status === 'processing' && 'animate-spin')} />
      {s.label}
    </span>
  )
}

function DashRow({ deck, username, userId }: { deck: DeckRow; username: string; userId: string }) {
  const ready = deck.status === 'ready'
  const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1'
  const coverUrl = deck.cover_image_key
    ? `https://${process.env.NEXT_PUBLIC_S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${deck.cover_image_key}`
    : '/placeholder.svg'

  const inner = (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-colors sm:p-4',
        ready && 'hover:border-accent/50',
      )}
    >
      <div className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:w-36">
        <img src={coverUrl} alt="" className="size-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <StatusBadge status={deck.status} />
          <Badge variant="outline" className="text-[10px]">
            {languageLabel(deck.original_language as any)} →{' '}
            {deck.target_languages.slice(0, 4).map((l) => languageLabel(l as any)).join(', ')}
            {deck.target_languages.length > 4 && ` +${deck.target_languages.length - 4}`}
          </Badge>
        </div>
        <h3 className="truncate font-heading text-base font-semibold text-foreground">
          {deck.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="size-3.5" />
            {deck.slide_count} slides
          </span>
          <span className="flex items-center gap-1">
            <Heart className="size-3.5" />
            {formatCount(deck.likes)}
          </span>
          <span>
            {new Date(deck.published_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {deck.status === 'failed' && (
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            Retry
          </Button>
        )}
        {deck.status === 'ready' && (
          <DeckVisibilityToggle
            deckId={deck.id}
            isPublic={deck.is_public ?? false}
          />
        )}
        <DeckDeleteButton deckId={deck.id} />
      </div>
    </div>
  )

  return ready ? (
    <Link href={`/@${username}/${deck.slug}`} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  )
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const decks = await withDb(async (client) => {
    const { rows } = await client.query<DeckRow>(
      `SELECT id, slug, title, original_language, target_languages,
              slide_count, views, likes, status, cover_image_key, published_at, is_public
       FROM decks
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY published_at DESC`,
      [userId],
    )
    return rows.map((r) => ({
      ...r,
      target_languages: Array.isArray(r.target_languages)
        ? r.target_languages
        : JSON.parse(r.target_languages as unknown as string),
    }))
  })

  const published = decks.filter((d) => d.status === 'ready')
  const totalViews = published.reduce((s, d) => s + d.views, 0)
  const totalLikes = published.reduce((s, d) => s + d.likes, 0)

  const stats = [
    { label: 'Decks', value: `${decks.length}` },
    { label: 'Total reads', value: formatCount(totalViews) },
    { label: 'Total likes', value: formatCount(totalLikes) },
    { label: 'Languages', value: `${new Set(decks.flatMap((d) => d.target_languages)).size}` },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Your decks
            </h1>
            <Button asChild>
              <Link href="/upload" className="gap-2">
                <Plus className="size-4" />
                New deck
              </Link>
            </Button>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="mt-1 font-heading text-2xl font-semibold text-foreground">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10">
            <h2 className="mb-4 font-heading text-xl font-bold tracking-tight text-foreground">
              Your decks
            </h2>
            {decks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
                <p className="font-heading text-lg font-semibold text-foreground">
                  No decks yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload your first PDF to get started.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/upload">Upload a deck</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {decks.map((deck) => (
                  <DashRow key={deck.id} deck={deck} username={userId} userId={userId} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
