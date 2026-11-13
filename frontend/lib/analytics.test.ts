import { describe, expect, it } from 'vitest'
import { buildDailySeries, countBySource, dayKeys, filterInRange, parseRange, topReferrerHosts, toDayKey } from './analytics'

// 2026-11-13 12:00 JST
const NOW = new Date('2026-11-13T03:00:00Z')

describe('analytics', () => {
  it('日付キーは日本時間で区切る', () => {
    // UTC 15:30 = JST 翌日 00:30
    expect(toDayKey('2026-11-12T15:30:00Z')).toBe('2026-11-13')
    expect(toDayKey('2026-11-12T14:59:00Z')).toBe('2026-11-12')
  })

  it('直近 N 日の日付キーを古い順に返す', () => {
    expect(dayKeys(3, NOW)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13'])
  })

  it('日別に PV とユニーク閲覧者数を集計し、閲覧の無い日は 0 で埋める', () => {
    const series = buildDailySeries(
      [
        { viewer_id: 'a', source: 'x', referrer_host: 't.co', viewed_at: '2026-11-13T01:00:00Z' },
        { viewer_id: 'a', source: 'x', referrer_host: 't.co', viewed_at: '2026-11-13T02:00:00Z' },
        { viewer_id: 'b', source: 'direct', referrer_host: null, viewed_at: '2026-11-13T02:30:00Z' },
        { viewer_id: 'c', source: 'direct', referrer_host: null, viewed_at: '2026-11-11T00:00:00Z' },
        { viewer_id: 'd', source: 'direct', referrer_host: null, viewed_at: '2026-10-01T00:00:00Z' }, // 範囲外
      ],
      3,
      NOW,
    )
    expect(series).toEqual([
      { date: '2026-11-11', views: 1, visitors: 1 },
      { date: '2026-11-12', views: 0, visitors: 0 },
      { date: '2026-11-13', views: 3, visitors: 2 },
    ])
  })

  it('流入元・参照元ホストを多い順に集計する', () => {
    const events = [
      { viewer_id: 'a', source: 'x', referrer_host: 't.co', viewed_at: NOW },
      { viewer_id: 'b', source: 'x', referrer_host: 'x.com', viewed_at: NOW },
      { viewer_id: 'c', source: 'direct', referrer_host: null, viewed_at: NOW },
      { viewer_id: 'd', source: 'unknown-legacy', referrer_host: 'zenn.dev', viewed_at: NOW },
      { viewer_id: 'e', source: 'other', referrer_host: 'zenn.dev', viewed_at: NOW },
    ]
    expect(countBySource(events)).toEqual([
      { source: 'x', views: 2 },
      { source: 'other', views: 2 },
      { source: 'direct', views: 1 },
    ])
    expect(topReferrerHosts(events)).toEqual([
      { host: 'zenn.dev', views: 2 },
      { host: 't.co', views: 1 },
      { host: 'x.com', views: 1 },
    ])
  })

  it('範囲外のイベントを除外する', () => {
    const events = [
      { viewer_id: 'a', source: 'x', referrer_host: null, viewed_at: '2026-11-13T00:00:00Z' },
      { viewer_id: 'b', source: 'x', referrer_host: null, viewed_at: '2026-11-01T00:00:00Z' },
    ]
    expect(filterInRange(events, 7, NOW)).toHaveLength(1)
  })

  it('期間パラメータは 7/30/90 以外を 30 に丸める', () => {
    expect(parseRange('7')).toBe(7)
    expect(parseRange('90')).toBe(90)
    expect(parseRange('15')).toBe(30)
    expect(parseRange(undefined)).toBe(30)
  })
})
