import { cookies } from 'next/headers'
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

// Cookie から現在の UI ロケールを解決する。未設定・不正値はデフォルト（en）。
export async function getLocaleFromCookie(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : defaultLocale
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
