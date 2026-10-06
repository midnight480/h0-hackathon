import { describe, expect, it } from 'vitest'
import { parseGoogleSlidesPresentationId } from './gslides'

const ID = '1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789_-ab'

describe('parseGoogleSlidesPresentationId', () => {
  it.each([
    `https://docs.google.com/presentation/d/${ID}/edit`,
    `https://docs.google.com/presentation/d/${ID}/edit#slide=id.p1`,
    `https://docs.google.com/presentation/d/${ID}/edit?usp=sharing`,
    `https://docs.google.com/presentation/d/${ID}/view`,
    `https://docs.google.com/presentation/d/${ID}/pub`,
    `https://docs.google.com/presentation/d/${ID}/present`,
    `https://docs.google.com/presentation/d/${ID}`,
    `https://docs.google.com/presentation/d/${ID}/`,
  ])('accepts %s', (url) => {
    expect(parseGoogleSlidesPresentationId(url)).toBe(ID)
  })

  it.each([
    '', // 空文字
    'not a url',
    'https://docs.google.com/document/d/abc123/edit', // Docs（Slides ではない）
    'https://docs.google.com/spreadsheets/d/abc123/edit', // Sheets
    'https://drive.google.com/file/d/abc123/view', // Drive ファイル
    'http://docs.google.com/presentation/d/abc123/edit', // http は拒否
    'https://docs.google.com.evil.example/presentation/d/abc123/edit', // ドメイン偽装
    'https://speakerdeck.com/user/talk',
    'https://docs.google.com/presentation/', // ID なし
    'https://docs.google.com/presentation/u/0/', // パス形式が違う
  ])('rejects %s', (url) => {
    expect(parseGoogleSlidesPresentationId(url)).toBeNull()
  })
})
