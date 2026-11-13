// デッキ閲覧の流入元（referrer）分類。
// 保存するのは分類（source）と参照元ホスト名のみで、参照元のフルURL（パス・クエリ）は保持しない。

export const VIEW_SOURCES = [
  'x',
  'facebook',
  'linkedin',
  'hatena',
  'slack',
  'line',
  'search',
  'other',
  'direct',
  'internal',
] as const

export type ViewSource = (typeof VIEW_SOURCES)[number]

export function isViewSource(v: unknown): v is ViewSource {
  return typeof v === 'string' && (VIEW_SOURCES as readonly string[]).includes(v)
}

export interface ViewContext {
  // document.referrer（空文字＝ダイレクト / referrer 非送信）
  referrer?: string | null
  // 閲覧ページURLの utm_source / ref クエリ（共有リンクに付与された場合）
  utmSource?: string | null
  // Facebook がリンクに付与する fbclid の有無
  hasFbclid?: boolean
  // サイト内のクライアント遷移で表示されたか（true の場合 document.referrer は当てにならない）
  clientNavigation?: boolean
}

export interface ClassifiedSource {
  source: ViewSource
  // 参照元ホスト（www. を除去・小文字）。不明な場合は null
  host: string | null
}

// ホスト名（サフィックス一致）→ 分類
const HOST_RULES: Array<[ViewSource, string[]]> = [
  ['x', ['x.com', 'twitter.com', 't.co']],
  ['facebook', ['facebook.com', 'fb.com', 'fb.me', 'messenger.com']],
  ['linkedin', ['linkedin.com', 'lnkd.in']],
  ['hatena', ['hatena.ne.jp', 'hatenablog.com', 'hatenablog.jp', 'hateblo.jp']],
  ['slack', ['slack.com']],
  ['line', ['line.me', 'line-apps.com']],
  [
    'search',
    ['google.com', 'google.co.jp', 'bing.com', 'yahoo.co.jp', 'yahoo.com', 'duckduckgo.com', 'search.brave.com', 'ecosia.org', 'baidu.com', 'naver.com'],
  ],
]

// utm_source の値 → 分類
const UTM_RULES: Record<string, ViewSource> = {
  x: 'x',
  twitter: 'x',
  facebook: 'facebook',
  fb: 'facebook',
  linkedin: 'linkedin',
  hatena: 'hatena',
  slack: 'slack',
  line: 'line',
  google: 'search',
}

function matchHost(host: string): ViewSource | null {
  for (const [source, domains] of HOST_RULES) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return source
  }
  return null
}

export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

function parseHost(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return normalizeHost(u.hostname)
  } catch {
    return null
  }
}

// 流入元を分類する。優先順位: クライアント遷移 > utm_source > referrer > fbclid > ダイレクト。
// selfHost は自サイトのホスト（自サイトからのフルページ遷移を internal とするため）。
export function classifySource(ctx: ViewContext, selfHost: string | null): ClassifiedSource {
  if (ctx.clientNavigation) return { source: 'internal', host: null }

  const utm = ctx.utmSource?.trim().toLowerCase().slice(0, 64)
  if (utm) {
    const mapped = UTM_RULES[utm]
    return { source: mapped ?? 'other', host: mapped ? null : utm }
  }

  const host = parseHost(ctx.referrer)
  if (host) {
    if (selfHost && host === normalizeHost(selfHost)) return { source: 'internal', host: null }
    return { source: matchHost(host) ?? 'other', host }
  }

  if (ctx.hasFbclid) return { source: 'facebook', host: null }
  return { source: 'direct', host: null }
}
