import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { withDb } from '@/lib/db'
import { formatCount } from '@/lib/data'
import { getServerI18n } from '@/lib/i18n'
import type { TFunc } from '@/lib/i18n/translate'
import {
  ANALYTICS_RANGES,
  type DailyPoint,
  type ViewEvent,
  buildDailySeries,
  countBySource,
  filterInRange,
  parseRange,
  rangeStart,
  topReferrerHosts,
} from '@/lib/analytics'
import { cn } from '@/lib/utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// デッキ所有者向けのアクセス分析ページ（日別推移・流入元・参照元サイト）。
// `/dashboard/decks/{deckId}?range=7|30|90`
export default async function DeckAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const range = parseRange((await searchParams).range)
  const { t } = await getServerI18n()
  const now = new Date()

  const data = await withDb(async (client) => {
    // 所有者のデッキのみ（他人のデッキ ID では 404）
    const { rows } = await client.query<{
      id: string
      slug: string
      title: string
      username: string | null
      views: number
    }>(
      `SELECT id, slug, title, username, views FROM decks
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId],
    )
    if (rows.length === 0) return null

    const { rows: events } = await client.query<ViewEvent>(
      `SELECT viewer_id, source, referrer_host, viewed_at FROM deck_view_events
       WHERE deck_id = $1 AND viewed_at >= $2`,
      [id, rangeStart(range + 1, now)],
    )
    return { deck: rows[0], events }
  })
  if (!data) notFound()

  const { deck } = data
  const events = filterInRange(data.events, range, now)
  const daily = buildDailySeries(events, range, now)
  const sources = countBySource(events)
  const hosts = topReferrerHosts(events)
  const rangeVisitors = new Set(events.map((e) => e.viewer_id)).size

  const stats = [
    { label: t('analytics.totalViews'), value: formatCount(deck.views) },
    { label: t('analytics.rangeViews'), value: formatCount(events.length) },
    { label: t('analytics.rangeVisitors'), value: formatCount(rangeVisitors) },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t('analytics.back')}
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('analytics.title')}</p>
              <h1 className="mt-1 text-pretty font-heading text-2xl font-bold tracking-tight text-foreground">
                {deck.title}
              </h1>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/@${deck.username ?? userId}/${deck.slug}`} className="gap-2">
                <ExternalLink className="size-4" />
                {t('analytics.openDeck')}
              </Link>
            </Button>
          </div>

          <nav className="mt-6 inline-flex rounded-lg border border-border p-1" aria-label={t('analytics.title')}>
            {ANALYTICS_RANGES.map((r) => (
              <Link
                key={r}
                href={`/dashboard/decks/${deck.id}?range=${r}`}
                aria-current={r === range ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  r === range
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('analytics.range', { days: r })}
              </Link>
            ))}
          </nav>

          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="mt-8 rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold text-foreground">{t('analytics.dailyTitle')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('analytics.dailyNote')}</p>
            {events.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t('analytics.noData')}</p>
            ) : (
              <DailyChart daily={daily} t={t} />
            )}
          </section>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-heading text-lg font-semibold text-foreground">{t('analytics.sourcesTitle')}</h2>
              {sources.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('analytics.noData')}</p>
              ) : (
                <BarList
                  items={sources.map((s) => ({ key: s.source, label: t(`analytics.source.${s.source}`), value: s.views }))}
                  total={events.length}
                />
              )}
            </section>
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-heading text-lg font-semibold text-foreground">{t('analytics.hostsTitle')}</h2>
              {hosts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('analytics.noData')}</p>
              ) : (
                <BarList
                  items={hosts.map((h) => ({ key: h.host, label: h.host, value: h.views }))}
                  total={events.length}
                />
              )}
            </section>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{t('analytics.note')}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

// 依存ライブラリを増やさず、flex の棒で日別推移を描く（ホバーで数値を表示）
function DailyChart({ daily, t }: { daily: DailyPoint[]; t: TFunc }) {
  const max = Math.max(1, ...daily.map((d) => d.views))
  const labelIdx = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])
  return (
    <div className="mt-4">
      <div className="flex items-end gap-1 border-b border-border" style={{ height: 180 }}>
        <span className="sr-only">{t('analytics.dailyTitle')}</span>
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-sm bg-accent/80 transition-colors group-hover:bg-accent"
              style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views > 0 ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
              <p className="font-medium">{d.date}</p>
              <p className="tabular-nums">
                {t('analytics.views')}: {d.views} / {t('analytics.visitors')}: {d.visitors}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-muted-foreground">
        {daily.map((d, i) => (
          <span key={d.date} className="flex-1 text-center tabular-nums">
            {labelIdx.has(i) ? shortDate(d.date) : ''}
          </span>
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t('analytics.dailyTable')}
        </summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">{t('analytics.date')}</th>
              <th className="py-1 text-right font-medium">{t('analytics.views')}</th>
              <th className="py-1 text-right font-medium">{t('analytics.visitors')}</th>
            </tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-1">{d.date}</td>
                <td className="py-1 text-right">{d.views}</td>
                <td className="py-1 text-right">{d.visitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function BarList({
  items,
  total,
}: {
  items: Array<{ key: string; label: string; value: number }>
  total: number
}) {
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((it) => {
        const pct = total > 0 ? Math.round((it.value / total) * 100) : 0
        return (
          <li key={it.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-foreground">{it.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {it.value} <span className="text-xs">({pct}%)</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
