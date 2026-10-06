import { describe, it, expect } from 'vitest'
import { resolveViewerId } from './viewer-id'

describe('viewer-id', () => {
  it('認証済みは user_id をそのまま返す（anonId より優先）', () => {
    expect(resolveViewerId('user_3F2LabcdEFGH', null)).toBe('user_3F2LabcdEFGH')
    expect(
      resolveViewerId('user_abc', '123e4567-e89b-42d3-a456-426614174000'),
    ).toBe('user_abc')
  })

  it('匿名は UUID を anon: 形式に正規化する', () => {
    expect(resolveViewerId(null, '123e4567-e89b-42d3-a456-426614174000')).toBe(
      'anon:123e4567-e89b-42d3-a456-426614174000',
    )
    // 大文字 UUID は小文字化する
    expect(resolveViewerId(null, '123E4567-E89B-42D3-A456-426614174000')).toBe(
      'anon:123e4567-e89b-42d3-a456-426614174000',
    )
  })

  it('匿名で UUID 以外・欠落は null', () => {
    expect(resolveViewerId(null, null)).toBe(null)
    expect(resolveViewerId(null, undefined)).toBe(null)
    expect(resolveViewerId(null, 12345)).toBe(null)
    expect(resolveViewerId(null, 'not-a-uuid')).toBe(null)
    expect(resolveViewerId(null, 'anon:123e4567-e89b-42d3-a456-426614174000')).toBe(null)
    expect(resolveViewerId(null, '')).toBe(null)
  })
})
