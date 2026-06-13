import { customAlphabet } from 'nanoid'

// デッキ公開識別子（Google Meet 形式）のユーティリティ。
// 正規形は小文字英字 a–z のみ・10文字（数字/大文字なし）。
// 表示形は `3-4-3` のハイフン区切り（例: abc-defg-hij）。

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'

// NanoID を a–z 辞書・10文字で初期化。生成は常に正規形を満たす。
const nano = customAlphabet(ALPHABET, 10)

/**
 * 新しい公開識別子（正規形10文字）を生成する。
 * 常に `^[a-z]{10}$` を満たす。
 */
export function generatePublicId(): string {
  return nano()
}

/**
 * 正規形（10文字）を表示形（`3-4-3` ハイフン区切り）へ変換する。
 * 例: `abcdefghij` -> `abc-defg-hij`
 */
export function formatPublicId(canonical: string): string {
  const c = canonical
  return `${c.slice(0, 3)}-${c.slice(3, 7)}-${c.slice(7, 10)}`
}

/**
 * 入力（表示形・大文字混じり等）を正規形へ正規化する。
 * ハイフンを除去し小文字化するだけの寛容な変換。
 * 例: `ABC-DEFG-HIJ` -> `abcdefghij`
 */
export function normalizePublicId(input: string): string {
  return input.replace(/-/g, '').toLowerCase()
}

/**
 * 文字列が正規形（小文字英字10文字）であるか判定する。
 */
export function isCanonicalId(s: string): boolean {
  return /^[a-z]{10}$/.test(s)
}
