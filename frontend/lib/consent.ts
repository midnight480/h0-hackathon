// Cookie 同意（閲覧分析・エラー時の画面記録）の状態管理。サーバー・クライアント共通の定義。
// 同意の選択自体を保存する Cookie は、選択を記憶するために必要なものとして同意前でも保存する。

export const CONSENT_COOKIE = 'hiravi_consent'
// 同意の有効期間（約6か月）。期限切れ後はバナーを再表示する。
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export type ConsentValue = 'granted' | 'denied'

export const CONSENT_CHANGE_EVENT = 'hiravi:consent-change'
export const CONSENT_OPEN_EVENT = 'hiravi:consent-open'

export function parseConsent(raw: string | null | undefined): ConsentValue | null {
  return raw === 'granted' || raw === 'denied' ? raw : null
}

// ---- クライアント専用ヘルパー ----

export function readConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`))
  return parseConsent(m?.[1])
}

export function writeConsent(value: ConsentValue): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent<ConsentValue>(CONSENT_CHANGE_EVENT, { detail: value }))
}

export function openConsentSettings(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}
