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
// 各言語タグを優先度（q 値。未指定は 1.0）の降順で並べ、対応言語（ja / en）に
// 最初にマッチしたものを採用する。これにより第1優先がサポート外でも、後続に
// 含まれる対応言語（例: "fr,ja;q=0.9" の ja）を正しく拾える。
// 同一 q 値内ではヘッダー記載順（左から右）を維持する。
function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
): Locale {
  if (!acceptLanguage) return defaultLocale

  // 例: "fr,ja;q=0.9,en;q=0.8" を [{ tag, q }] に分解する。
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1
      return {
        lang: tag?.trim().toLowerCase() ?? '',
        // 不正な q 値は 0 扱い（実質無視）。
        q: Number.isNaN(q) ? 0 : q,
        index,
      }
    })
    .filter((entry) => entry.lang.length > 0)
    // q 値の降順。同値はヘッダー記載順を維持する。
    .sort((a, b) => b.q - a.q || a.index - b.index)

  for (const { lang } of ranked) {
    // "ja-JP" など地域サブタグ付きにも対応するため前方一致で判定する。
    if (lang === 'ja' || lang.startsWith('ja-')) return 'ja'
    if (lang === 'en' || lang.startsWith('en-')) return 'en'
  }

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
