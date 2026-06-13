'use server'

import { cookies } from 'next/headers'
import { isLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config'

// UI ロケールを Cookie に書き込む Server Action。
// App Router では Cookie 書き込みはサーバ側で行う。呼び出し後にクライアントで
// router.refresh() すると SSR が再実行され、新しいロケールで再描画される。
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1年
    sameSite: 'lax',
  })
}
