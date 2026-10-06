// デッキのユニーク視聴者を識別する viewer_id を組み立てるユーティリティ。
// 形式は deck_likes.liker_id と同一: 認証済みは Clerk user_id、
// 匿名は `anon:<uuid>`（クライアントが localStorage に保持する UUID を送信）。

const ANON_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 視聴記録用の viewer_id を返す。
 * 認証済みユーザーは user_id をそのまま使い、未認証はクライアント送付の
 * 匿名 UUID を `anon:` 形式に正規化する。匿名 ID が不正・欠落なら null。
 */
export function resolveViewerId(
  userId: string | null,
  anonId: unknown,
): string | null {
  if (userId) return userId
  if (typeof anonId !== 'string' || !ANON_UUID_RE.test(anonId)) return null
  return `anon:${anonId.toLowerCase()}`
}
