# 要件定義: デッキ別ユニークView数（deck-view-count）

**Timestamp**: 2026-10-05
**Status**: Draft（承認待ち）
**Request Type**: Enhancement
**Scope**: `frontend/`（Route Handler・クライアント計測・ダッシュボード表示）+ `src/schema/schema.sql`

## 背景・目的

`decks.views` カラムは既に存在し、トップ・browse・関連デッキ・ユーザーページで
`ORDER BY views DESC`（人気順ソート）に利用済みだが、インクリメント処理と画面表示が
未実装のため全デッキ `views = 0` のまま。アップロードしたデッキごとのアクセス数を
投稿者が確認できるようにする。

## 確定済みの設計方針（ユーザー回答）

- **ユニークカウント**: 同一視聴者の再閲覧はカウントしない
- **所有者除外**: デッキ所有者自身の閲覧はカウントしない
- **Bot除外**: クライアント側 beacon 方式（`generateMetadata` 等のサーバー側レンダリングや
  JS非実行クローラーでは計測しない）
- **永続方式**: INSERT-only の `deck_views` テーブルで重複排除（当初設計 PROMPT.md・
  既存 `deck_likes` と同型の複合主キー）
- **表示箇所**: ダッシュボード（投稿者向け）のみ。公開ページ・デッキカードには出さない

## 機能要件

### FR-1: deck_views テーブル追加

`src/schema/schema.sql` に以下を追加（`deck_likes` と同型・`apply-schema` 再適用で冪等）。

```sql
CREATE TABLE IF NOT EXISTS deck_views (
    deck_id    UUID        NOT NULL,
    viewer_id  TEXT        NOT NULL,
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (deck_id, viewer_id)
);
CREATE INDEX ASYNC IF NOT EXISTS idx_deck_views_deck_id ON deck_views (deck_id);
```

- `viewer_id`: 認証済みは Clerk `user_id`、匿名は `anon:<uuid>`（`deck_likes.liker_id` と同一形式）
- `decks.views` は従来どおり非正規化カウンタとして維持し、ユニーク新規視聴のたびに +1

### FR-2: 視聴記録 Route Handler

`frontend/app/api/decks/[deckId]/view/route.ts`（POST）を新設。

1. `auth()` で `userId` を取得。あれば `viewer_id = userId`、無ければリクエストボディの
   匿名UUIDを検証し `viewer_id = anon:<uuid>`（不正・欠落は 400）
2. `SELECT user_id, is_public FROM decks WHERE id = $1 AND deleted_at IS NULL` で対象デッキ取得。
   未ヒットは 404
3. `is_public = false` かつ閲覧者が非所有者 → 404（存在を漏らさない。公開ページ側で既に
   ガード済みだが二重防御）
4. **所有者の閲覧 → カウントせず 200**（`counted: false`）
5. `BEGIN` → `INSERT INTO deck_views` → `UPDATE decks SET views = views + 1` → `COMMIT`。
   一意制約違反（23505）= 既視聴は `ROLLBACK` せず個別ハンドルし 200（`counted: false`）。
   ※ `likeDeck` と同様のトランザクション＋23505ハンドリングパターンに倣う
6. 成功時 200（`counted: true`）

### FR-3: クライアント計測コンポーネント

`frontend/components/view-tracker.tsx`（`'use client'`）を新設し、
`app/[user]/[slug]/page.tsx` のデッキ表示時にマウント。

- localStorage `hiravi_vid` に匿名UUIDを保持（未認証時の viewer_id として送信）
- localStorage `viewed:<deckId>` で「このブラウザでは送信済み」をガードし無駄なPOSTを抑制
  （サーバー側の複合主キーが最終的な重複排除。localStorage はあくまで送信削減）
- `useEffect` で1回だけ `fetch(keepalive: true)` POST。結果に関わらず再送しない
- `<Link>` prefetch や `generateMetadata` 呼び出しでは発火しない（クライアント実行のみ）
- スライド未生成（pending/processing/failed）のデッキでは計測しない
  （ビューアが表示される `deck.slides.length > 0` の場合のみマウント）

### FR-4: ダッシュボード表示

`frontend/app/dashboard/page.tsx`

- `DeckRow` SELECT に `views` を追加
- 各行のメタ行（スライド数・いいね・公開日）に `Eye` アイコン＋`formatCount(deck.views)` を追加
  （`Heart` 表示の隣・既存スタイル踏襲）

## 非機能要件 / 制約

- **失敗しても閲覧を阻害しない**: Route Handler・クライアント送信ともにエラー時は静かに
  握りつぶす（既存の `catch { return null }` / 表示優先の方針に合わせる）
- **カウント精度の許容範囲**: 匿名→ログインや別ブラウザは別 viewer_id となり重複しうる。
  「永続ユニーク（browser/identity単位）」を仕様として許容
- **DSQL**: OCC 競合理論上あり得るが、`views` 更新は1視聴1UPDATEで現規模では問題なし
- **セキュリティ**: viewer_id は形式検証のみ・自由入力をそのままINSERTするが PK 衝突以外の
  害はない。デッキIDはUUIDパスパラメータで検証
- **スキーマ適用は人間側で実施**: `cd src && pnpm db:schema`（`deck_views` 作成後に計測開始）

## スコープ外

- 公開ページ・デッキカードへの view 数表示
- 時系列分析・管理画面（`viewed_at` は保持するが集計UIは作らない）
- 既存デッキへの過去viewバックフィル（実績データが存在しないため不可）

## 変更ファイル見込み

| ファイル | 変更 |
|---|---|
| `src/schema/schema.sql` | `deck_views` テーブル＋インデックス追加 |
| `frontend/app/api/decks/[deckId]/view/route.ts` | 新規（POST 視聴記録） |
| `frontend/components/view-tracker.tsx` | 新規（beacon 計測） |
| `frontend/app/[user]/[slug]/page.tsx` | `<ViewTracker>` マウント追加 |
| `frontend/app/dashboard/page.tsx` | `views` SELECT・Eye アイコン表示追加 |

## 検証計画

- `pnpm build`（型チェック含む）成功
- vitest：viewer_id 組み立て・匿名UUID検証のユニットテスト（既存 `lib/username.test.ts` 等と同格）
- 手動確認（ブラウザ）：公開デッキを別ブラウザで開く→dashboard に +1 反映、再読込で増えない、
  所有者自身では増えない
