// 公開URL `/@{user}/{slug}` の `{user}` 部分（username / user_id）を扱うユーティリティ。
// username は Clerk のサインアップ時に必須化され、Restrict changes=ON により不変。
// 非正規化値として `decks.username` に保存し、閲覧/一覧は Clerk API を呼ばず DSQL で解決する。

/**
 * `raw` が Clerk の user_id（`user_...` プレフィックス）かどうかを判定する。
 * 旧URL（user_id 形式）を検出し、username 形式へ 301 リダイレクトするために使う。
 */
export function isUserId(raw: string): boolean {
  return /^user_/.test(raw)
}

/**
 * username を保存・検索で統一するために正規化する。
 * Clerk は username の一意性を大文字小文字を区別せず保証するため、
 * 前後空白を除去し小文字化して保持・照合する（idx_decks_username を活かせる）。
 */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}
