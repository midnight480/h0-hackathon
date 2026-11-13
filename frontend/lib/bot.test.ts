import { describe, expect, it } from 'vitest'
import { isBotUserAgent } from './bot'

describe('isBotUserAgent', () => {
  it('一般的なブラウザは Bot と判定しない', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe(false)
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false)
  })

  it('クローラー・ヘッドレス・CLI クライアントを Bot と判定する', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 HeadlessChrome/130.0.0.0')).toBe(true)
    expect(isBotUserAgent('Slackbot-LinkExpanding 1.0')).toBe(true)
    expect(isBotUserAgent('curl/8.4.0')).toBe(true)
  })

  it('User-Agent 欠落は Bot とみなす', () => {
    expect(isBotUserAgent(null)).toBe(true)
    expect(isBotUserAgent('')).toBe(true)
  })
})
