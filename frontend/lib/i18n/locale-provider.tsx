'use client'

import { createContext, useContext, useMemo } from 'react'
import type { Locale } from './config'
import type { Dictionary } from './dictionaries/en'
import { createTranslator, type TFunc } from './translate'

interface LocaleContextValue {
  locale: Locale
  t: TFunc
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

// サーバ（layout.tsx）で解決した locale と辞書を受け取り、Client に t を供給する。
// 辞書は現在のロケール 1 言語分のみ。両言語をクライアントに同梱しない。
export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale
  dictionary: Dictionary
  children: React.ReactNode
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslator(dictionary) }),
    [locale, dictionary],
  )
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale は LocaleProvider 内で使用してください')
  }
  return ctx
}

// 翻訳関数だけを取り出すショートカット。
export function useT(): TFunc {
  return useLocale().t
}
