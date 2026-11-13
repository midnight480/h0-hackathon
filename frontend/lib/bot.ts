// View 数カウントから除外するクローラー／自動化クライアントの User-Agent 判定。
// 主な除外はクライアント側 beacon（JS 実行が前提）で行い、これは JS を実行する
// ヘッドレスブラウザ等を取りこぼさないための補助的な判定。
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|preview|facebookexternalhit|embedly|quora link|whatsapp|curl|wget|python-requests|axios|node-fetch|go-http-client|playwright|puppeteer|phantomjs/i

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim() === '') return true
  return BOT_UA_PATTERN.test(ua)
}
