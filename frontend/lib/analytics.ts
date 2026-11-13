// デッキ分析ページ用の集計（純粋関数）。DSQL 側の日付関数・集計に依存せず、
// 期間内の閲覧イベントを取得してアプリ側で集計する。

import { type ViewSource, isViewSource } from './referrer'

// 日付の区切りは日本時間（利用者の大半が日本のため。UIにも明記する）
export const ANALYTICS_TIME_ZONE = 'Asia/Tokyo'
export const ANALYTICS_RANGES = [7, 30, 90] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

export function parseRange(raw: string | string[] | undefined): AnalyticsRange {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : 30
}

export interface ViewEvent {
  viewer_id: string
  source: string
  referrer_host: string | null
  viewed_at: Date | string
}

export interface DailyPoint {
  date: string // YYYY-MM-DD（ANALYTICS_TIME_ZONE）
  views: number // 閲覧回数（PV）
  visitors: number // ユニーク閲覧者数
}

export interface SourceCount {
  source: ViewSource
  views: number
}

export interface HostCount {
  host: string
  views: number
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ANALYTICS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function toDayKey(d: Date | string): string {
  return dayFormatter.format(typeof d === 'string' ? new Date(d) : d)
}

// now を含む直近 days 日分の日付キー（古い順）
export function dayKeys(days: number, now: Date = new Date()): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    keys.push(toDayKey(new Date(now.getTime() - i * 86_400_000)))
  }
  return [...new Set(keys)]
}

// 期間の取得開始時刻（タイムゾーン差を吸収するため 1 日余分に取り、集計時に日付キーで絞る）
export function rangeStart(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000)
}

export function buildDailySeries(events: ViewEvent[], days: number, now: Date = new Date()): DailyPoint[] {
  const keys = dayKeys(days, now)
  const buckets = new Map(keys.map((k) => [k, { views: 0, visitors: new Set<string>() }]))
  for (const e of events) {
    const b = buckets.get(toDayKey(e.viewed_at))
    if (!b) continue
    b.views++
    b.visitors.add(e.viewer_id)
  }
  return keys.map((date) => {
    const b = buckets.get(date)!
    return { date, views: b.views, visitors: b.visitors.size }
  })
}

// 期間内（日付キーが範囲内）のイベントのみに絞る
export function filterInRange(events: ViewEvent[], days: number, now: Date = new Date()): ViewEvent[] {
  const keys = new Set(dayKeys(days, now))
  return events.filter((e) => keys.has(toDayKey(e.viewed_at)))
}

export function countBySource(events: ViewEvent[]): SourceCount[] {
  const m = new Map<ViewSource, number>()
  for (const e of events) {
    const s: ViewSource = isViewSource(e.source) ? e.source : 'other'
    m.set(s, (m.get(s) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([source, views]) => ({ source, views }))
    .sort((a, b) => b.views - a.views)
}

export function topReferrerHosts(events: ViewEvent[], limit = 10): HostCount[] {
  const m = new Map<string, number>()
  for (const e of events) {
    if (!e.referrer_host) continue
    m.set(e.referrer_host, (m.get(e.referrer_host) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([host, views]) => ({ host, views }))
    .sort((a, b) => b.views - a.views || a.host.localeCompare(b.host))
    .slice(0, limit)
}
