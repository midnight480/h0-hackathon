// サーバーアクションで受け取るユーザー入力を検証・正規化するための共通ユーティリティ。
//
// 目的:
// - クライアント UI を経由せず Server Action を直接呼び出す改ざんリクエストを防ぐ
// - 過大な文字列による DB 肥大化を防ぐ
// - category / language を許可リストに限定し、不正値の保存を防ぐ
// - targetLanguages の件数を制限し、Amazon Translate の呼び出し増幅（コスト/DoS）を防ぐ
import { CATEGORIES, LANGUAGES, type Category, type LanguageCode } from '@/lib/data'

export const MAX_TITLE_LENGTH = 200
export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_TARGET_LANGUAGES = 20

// UUID v4 を含む一般的な UUID 形式
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_CATEGORIES = new Set<string>(
  CATEGORIES.filter((c) => c.value !== 'all').map((c) => c.value),
)
const VALID_LANGUAGES = new Set<string>(LANGUAGES.map((l) => l.code))

export function assertUuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${field}`)
  }
  return value
}

export function validateTitle(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid title')
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new Error('Title is required')
  if (trimmed.length > MAX_TITLE_LENGTH) throw new Error('Title is too long')
  return trimmed
}

export function validateDescription(value: unknown): string {
  if (value == null) return ''
  if (typeof value !== 'string') throw new Error('Invalid description')
  const trimmed = value.trim()
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) throw new Error('Description is too long')
  return trimmed
}

export function validateCategory(value: unknown): Category {
  if (typeof value !== 'string' || !VALID_CATEGORIES.has(value)) {
    throw new Error('Invalid category')
  }
  return value as Category
}

export function validateLanguageCode(value: unknown): LanguageCode {
  if (typeof value !== 'string' || !VALID_LANGUAGES.has(value)) {
    throw new Error('Invalid language code')
  }
  return value as LanguageCode
}

// targetLanguages を検証し、重複除去・件数上限を適用した配列を返す。
export function validateTargetLanguages(value: unknown): LanguageCode[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('At least one target language is required')
  }
  const unique = [...new Set(value)]
  if (unique.length > MAX_TARGET_LANGUAGES) {
    throw new Error('Too many target languages')
  }
  return unique.map((code) => validateLanguageCode(code))
}

export interface DeckMetadataInput {
  title: unknown
  description: unknown
  category: unknown
  originalLanguage: unknown
  targetLanguages: unknown
}

export interface DeckMetadata {
  title: string
  description: string
  category: Category
  originalLanguage: LanguageCode
  targetLanguages: LanguageCode[]
}

// デッキのメタデータ一式を検証・正規化して返す。
export function validateDeckMetadata(input: DeckMetadataInput): DeckMetadata {
  return {
    title: validateTitle(input.title),
    description: validateDescription(input.description),
    category: validateCategory(input.category),
    originalLanguage: validateLanguageCode(input.originalLanguage),
    targetLanguages: validateTargetLanguages(input.targetLanguages),
  }
}
