import { cookies, headers } from 'next/headers'
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config'
import { en, type Dictionary } from './dictionaries/en'
import { ja } from './dictionaries/ja'
import { createTranslator, type TFunc } from './translate'

// サーバ専用モジュール（next/headers に依存）。クライアントコンポーネントからは
// import しないこと。クライアントは locale-provider の useT を使う。
const dictionaries: Record<Locale, Dictionary> = { en, ja }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en
}

// Accept-Language ヘッダーから UI ロケールを推定する。
// 先頭（最優先）の言語タグが日本語（ja / ja-JP 等）なら 'ja'、それ以外は 'en'。
// 簡易判定で十分（対応は ja / en の2値のみ）。
function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
): Locale {
  if (!acceptLanguage) return defaultLocale
  // 例: "ja,en-US;q=0.9,en;q=0.8" → 主要言語タグを取り出す。
  const primary = acceptLanguage
    .split(',')[0]
    ?.trim()
    .split(';')[0]
    ?.trim()
    .toLowerCase()
  if (primary?.startsWith('ja')) return 'ja'
  return defaultLocale
}

// 現在の UI ロケールを解決する。
// 優先順位:
//   1. Cookie（ユーザーがトグルで明示的に選択した値）
//   2. ブラウザの言語（Accept-Language ヘッダー。日本語なら ja、それ以外は en）
//   3. デフォルト（en）
// これにより初回アクセス時はブラウザ言語で自動選択され、トグル操作後は
// Cookie が優先されるためブラウザ言語と異なる言語にも切り替えられる。
export async function getLocaleFromCookie(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  if (isLocale(value)) return value

  const headerStore = await headers()
  return detectLocaleFromAcceptLanguage(headerStore.get('accept-language'))
}

// サーバコンポーネント向けヘルパ: ロケール解決 + 翻訳関数 + 辞書をまとめて返す。
export async function getServerI18n(): Promise<{
  locale: Locale
  t: TFunc
  dictionary: Dictionary
}> {
  const locale = await getLocaleFromCookie()
  const dictionary = getDictionary(locale)
  return { locale, t: createTranslator(dictionary), dictionary }
}
