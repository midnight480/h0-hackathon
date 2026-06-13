# フロントエンド構成 — slug-identifier

> 本機能は主にルーティング/サーバーロジックの変更で、UI コンポーネントの新規追加はほぼ無い。

## 1. アップロードフォーム（`frontend/app/upload/page.tsx`）
- **変更なし（UI）**: slug 入力フィールドは追加しない（カスタム入力は不採用）。
- 既存の title/description/category/original/targets の入力はそのまま。
- 送信後、`createDeckRecord` の戻り値で得た**表示形 slug（`abc-defg-hij`）**を使って完了画面・共有リンクを生成する。

## 2. server action（`frontend/app/actions/upload.ts`）
- `toSlug()` / `generateShortId()` を**廃止**し、`generatePublicId()`（NanoID, a–z, 10）に置き換え。
- `createDeckRecord`: `slug = publicId`、`legacy_slug = NULL`、`short_id` は設定しない（新規採番なし）。
- UNIQUE 違反 / OCC コンフリクト時の再生成リトライを実装（BR-4）。
- 共有用に `formatPublicId()` を提供。

## 3. 主URLルート（`frontend/app/[user]/[slug]/page.tsx`）
- パラメータ `slug` を `normalizePublicId()` → `isCanonicalId()` 判定。
- 正規ID一致なら表示、未ヒットなら `legacy_slug` で照合し新URLへ 301（BR-5）。
- Next.js の `redirect()`（App Router）で恒久リダイレクト。

## 4. ショートURLルート（`frontend/app/s/[code]/route.ts`）
- `short_id = code` で検索し、新URL `/@{user_id}/{format(slug)}` へ 301（BR-6）。
- レガシー専用（新規発行なし）。

## 5. 表示ユーティリティ（新規・共通）
- `lib/public-id.ts`（新規想定）: `generatePublicId` / `formatPublicId` / `normalizePublicId` / `isCanonicalId` を集約し、frontend 各所と移行スクリプトから再利用する。

## ユーザーインタラクションフロー
```
アップロード完了
  → 表示形 slug (abc-defg-hij) を含む共有URL /@user/abc-defg-hij を提示
旧リンク踏み込み
  → /@user/{old-title-slug} or /s/{old-short-id}
  → 301 → /@user/{new-display-slug}
```

## API 連携ポイント
- フォーム → `getPresignedUploadUrl` → S3 直アップロード（変更なし）
- フォーム → `createDeckRecord`（採番・INSERT、本機能の中心）
- フォーム → `enqueueProcessing`（SQS、変更なし）
- 閲覧/リダイレクト → `lib/db` 経由の SELECT（解決ロジックを更新）
