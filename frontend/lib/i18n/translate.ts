import type { Dictionary } from './dictionaries/en'

// プレースホルダ置換に渡せる値。
export type TParams = Record<string, string | number>

// `t('nav.browse')` のようなドット区切りキーで辞書を引く翻訳関数の型。
export type TFunc = (path: string, params?: TParams) => string

// 辞書から翻訳関数を生成する。サーバ/クライアント双方で利用するため副作用なし・server-only 非依存。
export function createTranslator(dictionary: Dictionary): TFunc {
  return (path, params) => {
    const value = path
      .split('.')
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[key]
            : undefined,
        dictionary,
      )

    // キーが存在しない場合はキー名をそのまま返す（フォールバック）。
    if (typeof value !== 'string') return path
    if (!params) return value

    // `{name}` 形式のプレースホルダを置換する簡易補間。
    return value.replace(/\{(\w+)\}/g, (_, key: string) =>
      key in params ? String(params[key]) : `{${key}}`,
    )
  }
}
