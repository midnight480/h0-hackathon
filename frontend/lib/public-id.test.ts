import { describe, it, expect } from 'vitest'
import {
  generatePublicId,
  formatPublicId,
  normalizePublicId,
  isCanonicalId,
} from './public-id'

describe('public-id', () => {
  it('generatePublicId は常に正規形（小文字英字10文字）を満たす', () => {
    for (let i = 0; i < 1000; i++) {
      const id = generatePublicId()
      expect(isCanonicalId(id)).toBe(true)
    }
  })

  it('formatPublicId は 3-4-3 のハイフン区切りに整形する', () => {
    expect(formatPublicId('abcdefghij')).toBe('abc-defg-hij')
  })

  it('normalizePublicId はハイフン除去・小文字化する', () => {
    expect(normalizePublicId('abc-defg-hij')).toBe('abcdefghij')
    expect(normalizePublicId('ABC-DEFG-HIJ')).toBe('abcdefghij')
    expect(normalizePublicId('abcdefghij')).toBe('abcdefghij')
  })

  it('往復一致: normalizePublicId(formatPublicId(c)) === c', () => {
    for (let i = 0; i < 1000; i++) {
      const c = generatePublicId()
      expect(normalizePublicId(formatPublicId(c))).toBe(c)
    }
  })

  it('isCanonicalId は数字・大文字・長さ違いを拒否する', () => {
    expect(isCanonicalId('abcdefghij')).toBe(true)
    expect(isCanonicalId('abc-defg-hij')).toBe(false) // ハイフンあり
    expect(isCanonicalId('abcdefghi1')).toBe(false) // 数字
    expect(isCanonicalId('Abcdefghij')).toBe(false) // 大文字
    expect(isCanonicalId('abcdefghi')).toBe(false) // 9文字
    expect(isCanonicalId('abcdefghijk')).toBe(false) // 11文字
  })
})
