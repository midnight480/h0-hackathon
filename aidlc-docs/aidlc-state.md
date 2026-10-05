# AI-DLC State Tracking

## Project Information
- **Project Type**: Brownfield
- **Start Date**: 2026-06-04T00:00:00Z
- **Current Stage**: CONSTRUCTION - Code Generation / Build and Test 完了（deck-ogp-viewer）
- **Active Feature**: デッキ個別OGP＋ビューア改善（既定オリジナル・タブ順変更・全画面表示）
- **Completed Feature**: 公開URLの user 部分を Clerk username 化 / 公開識別子の Google Meet 形式ランダムID化

## Workspace State
- **Existing Code**: Yes
- **Reverse Engineering Needed**: Yes
- **Workspace Root**: /Users/tetsuya/Documents/src/h0-hackathon

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Stage Progress
| Phase | Stage | Status |
|-------|-------|--------|
| INCEPTION | Workspace Detection | [x] Completed |
| INCEPTION | Reverse Engineering | [x] Completed |
| INCEPTION | Requirements Analysis | [x] Completed |
| INCEPTION | User Stories | [-] Skipped (単一の識別子刷新で挙動が明確) |
| INCEPTION | Workflow Planning | [x] Completed |
| INCEPTION | Application Design | [-] Skip (新規コンポーネントなし) |
| INCEPTION | Units Generation | [-] Skip (分解不要) |

## Execution Plan Summary
- **Stages to Execute**: Functional Design (軽量), Code Generation, Build and Test
- **Stages to Skip**: User Stories, Application Design, Units Planning/Generation, NFR Requirements, NFR Design, Infrastructure Design
- **Risk Level**: Medium
- **Next Stage**: Construction - Functional Design

## Construction Stage Progress — slug-identifier ユニット
| Phase | Stage | Status |
|-------|-------|--------|
| CONSTRUCTION | Functional Design | [x] Completed（成果物4点・承認済） |
| CONSTRUCTION | NFR Requirements | [-] Skip |
| CONSTRUCTION | NFR Design | [-] Skip |
| CONSTRUCTION | Infrastructure Design | [-] Skip |
| CONSTRUCTION | Code Generation | [x] Completed |
| CONSTRUCTION | Build and Test | [x] Completed |

### 実装サマリ（slug-identifier）
- 公開識別子を Google Meet 形式（小文字英字10文字・表示 3-4-3）のランダムID（NanoID）へ一本化。
- 変更ファイル: `frontend/lib/public-id.ts`（新規）, `frontend/lib/public-id.test.ts`（新規）, `src/schema/schema.sql`, `frontend/app/actions/upload.ts`, `frontend/app/[user]/[slug]/page.tsx`, `frontend/app/s/[code]/route.ts`, `src/scripts/migrate-public-id.ts`（新規）。
- 検証: vitest 5件 PASS / `pnpm build`（TypeScript 型チェック含む）成功。
- 移行: `cd src && pnpm db:migrate-public-id`（冪等・衝突リトライ・short_id 温存）。

## Construction Stage Progress — username-routing ユニット
| Phase | Stage | Status |
|-------|-------|--------|
| CONSTRUCTION | Functional Design | [-] Skip（要件定義で確定済・新規コンポーネントなし） |
| CONSTRUCTION | NFR Requirements | [-] Skip |
| CONSTRUCTION | NFR Design | [-] Skip |
| CONSTRUCTION | Infrastructure Design | [-] Skip |
| CONSTRUCTION | Code Generation | [x] Completed |
| CONSTRUCTION | Build and Test | [x] Completed |

### 実装サマリ（username-routing）
- 公開URL `/@{user}/{slug}` の `{user}` を Clerk `user_id` から非可読を解消する **username** へ置換。DB 非正規化方式（`decks.username`）。
- スキーマ: `src/schema/schema.sql` に `username TEXT`（NULL 可）＋ `idx_decks_username` を追加。`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` で既存テーブルにべき等反映。
- 作成時保存: `frontend/app/actions/upload.ts` で Clerk から username を取得し INSERT に追加（取得不可は NULL）。
- ルーティング: `frontend/app/[user]/[slug]/page.tsx` で `^user_`（旧 user_id URL）を判定し、所有者に username があれば `/@{username}/{slug}` へ 301。username 形式は `decks.username` で直接検索（Clerk 非呼出）。username 未設定は user_id フォールバック。slug の正規化・寛容ルックアップ・可視性判定は既存維持。
- 表示/リンク username 化: `app/page.tsx` / `app/browse/page.tsx` / `app/dashboard/page.tsx` / `app/[user]/page.tsx` / 関連デッキ / ショートURL `app/s/[code]/route.ts`（`username ?? user_id`）。`components/deck-card.tsx`・`components/deck-viewer.tsx` は `author.username` 経由のため変更不要。
- 新規: `frontend/lib/username.ts`（`isUserId` / `normalizeUsername`）＋ `frontend/lib/username.test.ts`。
- バックフィル: `src/scripts/backfill-username.ts`（distinct user_id ごとに Clerk REST で username 解決→一括 UPDATE・冪等）。`src/package.json` に `db:backfill-username` 登録。
- 検証: vitest 8件 PASS（public-id 5 + username 3）/ `frontend` `next build`（TypeScript 型チェック含む）成功。
- 移行（人間側で実施）: `cd src && pnpm db:schema`（username 列追加）→ `pnpm db:backfill-username`（要 `CLERK_SECRET_KEY`・`DSQL_ENDPOINT`・AWS 認証情報）。

## Construction Stage Progress — deck-ogp-viewer ユニット
| Phase | Stage | Status |
|-------|-------|--------|
| CONSTRUCTION | Functional Design | [-] Skip（要件定義で確定済・新規コンポーネントなし） |
| CONSTRUCTION | NFR Requirements | [-] Skip |
| CONSTRUCTION | NFR Design | [-] Skip |
| CONSTRUCTION | Infrastructure Design | [-] Skip |
| CONSTRUCTION | Code Generation | [x] Completed |
| CONSTRUCTION | Build and Test | [x] Completed |

### 実装サマリ（deck-ogp-viewer）
- OGP: `app/[user]/[slug]/page.tsx` に `generateMetadata` 追加。og:title=デッキ title、og:description=デッキ description、og:image=先頭スライド画像（なければ cover_image_key、それも無ければブランドOGPにフォールバック）。非公開デッキは既定メタのみ（漏洩防止）。
- ビューア: 既定 viewMode を `image`（オリジナル）に変更、タブ順を image/text/overlay に変更。
- 全画面: スライド表示エリア右下のボタンで Fullscreen API による全画面化。全画面中は左右ボタン/キーボード/ページ番号表示で移動可能、オーバーレイモードも位置ずれなく動作。
- 変更ファイル: `frontend/app/[user]/[slug]/page.tsx`, `frontend/components/deck-viewer.tsx`, `frontend/lib/i18n/dictionaries/{en,ja}.ts`
- 検証: `pnpm build`（型チェック含む）成功 / vitest 8件 PASS
- 要件: `aidlc-docs/inception/requirements/deck-ogp-viewer-requirements.md`

## Extension Configuration
(extensions/ ディレクトリは空のため、適用対象なし)
