import { describe, it, expect } from 'vitest'
import { isUserId, normalizeUsername } from './username'

describe('username', () => {
  it('isUserId は Clerk user_id（user_ プレフィックス）を判定する', () => {
    expect(isUserId('user_3F2LabcdEFGH')).toBe(true)
    expect(isUserId('user_')).toBe(true)
    expect(isUserId('midnight480')).toBe(false)
    expect(isUserId('john_doe')).toBe(false) // 途中に _ があっても先頭が user_ でなければ username
    expect(isUserId('User_123')).toBe(false) // 大文字始まりは user_id ではない
  })

  it('normalizeUsername は前後空白除去・小文字化する', () => {
    expect(normalizeUsername('MidNight480')).toBe('midnight480')
    expect(normalizeUsername('  midnight480  ')).toBe('midnight480')
    expect(normalizeUsername('midnight480')).toBe('midnight480')
  })

  it('正規化は冪等（再適用しても不変）', () => {
    const once = normalizeUsername('MidNight480')
    expect(normalizeUsername(once)).toBe(once)
  })
})
