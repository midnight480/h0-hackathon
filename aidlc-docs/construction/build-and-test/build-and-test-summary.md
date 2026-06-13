# Build and Test サマリ — slug-identifier ユニット

## ユニットテスト（`frontend/lib/public-id.test.ts`, vitest）
実行: `cd frontend && pnpm test`

| ケース | 結果 |
|--------|------|
| `generatePublicId()` は常に `isCanonicalId` を満たす（1000回） | PASS |
| `formatPublicId('abcdefghij') === 'abc-defg-hij'` | PASS |
| `normalizePublicId('abc-defg-hij') === 'abcdefghij'`（大文字・ハイフン無しも） | PASS |
| 往復一致 `normalizePublicId(formatPublicId(c)) === c`（1000回） | PASS |
| `isCanonicalId` が数字/大文字/長さ違いを拒否 | PASS |

結果: **5 passed (5)**

## ビルド
実行: `cd frontend && pnpm build`
- Next.js 本番ビルド成功（`✓ Compiled successfully`）。
- TypeScript 型チェック成功（`Finished TypeScript`）。
- 全12ルートの生成成功（`/[user]/[slug]`, `/s/[code]`, `/upload` 含む）。

## Lint
- `pnpm lint`（`eslint .`）は **リポジトリに eslint 設定ファイル（eslint.config.js 等）が存在しない**ため失敗。
- これは本変更とは無関係の既存問題（変更前から lint 設定が未整備）。本変更で新たな lint エラーは導入していない。

## 手動確認（結合・要DB環境）
以下は DSQL 接続環境での確認項目（コードレビュー観点で実装済み）:
- アップロード → 採番 → `/@user/abc-defg-hij` で閲覧。
- `/@user/abcdefghij`（ハイフン無し）でも同一デッキへ解決。
- 旧タイトル slug URL / `/s/{old-short-id}` が新URLへ 301 相当リダイレクト。
- 移行スクリプト（`cd src && pnpm db:migrate-public-id`）は2回実行しても結果不変（冪等）。

## ステータス
- [x] Build and Test 完了
