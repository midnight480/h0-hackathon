import { describe, expect, it } from 'vitest'
import { classifySource } from './referrer'

const SELF = 'hiravi.example.com'

describe('classifySource', () => {
  it('referrer 無しはダイレクト', () => {
    expect(classifySource({ referrer: '' }, SELF)).toEqual({ source: 'direct', host: null })
    expect(classifySource({}, SELF)).toEqual({ source: 'direct', host: null })
  })

  it('X / Facebook / LinkedIn / はてな / 検索を分類する', () => {
    expect(classifySource({ referrer: 'https://t.co/abc' }, SELF)).toEqual({ source: 'x', host: 't.co' })
    expect(classifySource({ referrer: 'https://x.com/someone/status/1' }, SELF).source).toBe('x')
    expect(classifySource({ referrer: 'https://l.facebook.com/' }, SELF)).toEqual({ source: 'facebook', host: 'l.facebook.com' })
    expect(classifySource({ referrer: 'https://www.linkedin.com/feed/' }, SELF)).toEqual({ source: 'linkedin', host: 'linkedin.com' })
    expect(classifySource({ referrer: 'https://b.hatena.ne.jp/entry/x' }, SELF).source).toBe('hatena')
    expect(classifySource({ referrer: 'https://www.google.co.jp/' }, SELF).source).toBe('search')
  })

  it('未知の参照元は other としてホスト名を保持する', () => {
    expect(classifySource({ referrer: 'https://zenn.dev/articles/foo?x=1' }, SELF)).toEqual({ source: 'other', host: 'zenn.dev' })
  })

  it('自サイトからの遷移・クライアント遷移は internal', () => {
    expect(classifySource({ referrer: `https://${SELF}/browse` }, SELF).source).toBe('internal')
    expect(classifySource({ referrer: 'https://t.co/abc', clientNavigation: true }, SELF).source).toBe('internal')
  })

  it('utm_source を referrer より優先する', () => {
    expect(classifySource({ referrer: '', utmSource: 'twitter' }, SELF).source).toBe('x')
    expect(classifySource({ referrer: 'https://t.co/a', utmSource: 'newsletter' }, SELF)).toEqual({ source: 'other', host: 'newsletter' })
  })

  it('referrer が無くても fbclid があれば Facebook', () => {
    expect(classifySource({ referrer: '', hasFbclid: true }, SELF).source).toBe('facebook')
  })

  it('http(s) 以外の referrer は無視する', () => {
    expect(classifySource({ referrer: 'android-app://com.slack' }, SELF).source).toBe('direct')
  })
})
