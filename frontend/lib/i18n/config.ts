// UI ロケール（アプリ画面文言の言語）の基本設定。
// 注意: ここで扱う「ロケール」は deck-viewer の閲覧言語（75言語）とは無関係。
export const locales = ['en', 'ja'] as const

export type Locale = (typeof locales)[number]

// デフォルトは英語（現状維持）。
export const defaultLocale: Locale = 'en'

// ロケールを永続化する Cookie 名。
export const LOCALE_COOKIE = 'hiravi_locale'

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}
