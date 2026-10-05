# 要件定義: デッキ個別OGP + スライドビューア改善

- **作成日**: 2026-10-05
- **対象**: `frontend`（Next.js App Router）
- **深度**: Minimal（要求が明確・既存機能の改修）

## 背景

1. デッキURL共有時の OGP がサイト共通のデフォルト（`app/layout.tsx` + `app/opengraph-image.tsx`）のままになっている。
2. ビューアの既定表示モードが「オーバーレイ（重ねて表示）」であり、日本語スライドでは元スライドのフォントが失われて見える。
3. 表示モード切替の並びが「オーバーレイ / テキスト / オリジナル」であり、オリジナルが最後。
4. スライド表示が固定枠のみで、全画面表示ができない。

## 機能要件

### FR-1: デッキ個別の OGP メタデータ

- `app/[user]/[slug]/page.tsx` に `generateMetadata` を追加し、デッキ単位のメタデータを返す。
- `og:title` / `<title>` = デッキ登録時の `title`
- `og:description` = デッキ登録時の `description`
- `og:image` = スライド 1 枚目の画像（`slides.image_key` の page_number 最小）の S3 URL
- Twitter カードも同内容（`summary_large_image`）
- 対象 URL: `/@{username|user_id}/{slug}`（username 形式・旧 user_id 形式の両方で解決。正規 slug のみ対象で、レガシー slug や未ヒット時は既定メタにフォールバック）
- **セキュリティ**: `is_public = false` のデッキは OGP にタイトル・説明・画像を出力しない（情報漏洩防止。既定メタを返す）
- 画像が無い場合は `images` を未設定にし、既存の `opengraph-image.tsx`（ブランド画像）にフォールバック
- 短縮URL `/s/{code}` は 301 でデッキURLへリダイレクトされるため、デッキ側のメタでカバーする（追加対応なし）

### FR-2: 既定表示モードを「オリジナル」に変更

- `DeckViewer` の `viewMode` 初期値を `'image'`（オリジナル）に固定する。
- 理由: 日本語スライドをオーバーレイ既定で出すと元スライドのフォントが失われるため。必要に応じてユーザーがオーバーレイへ切替可能とする。

### FR-3: 表示モードタブの並び替え

- ボタン順を `オリジナル / テキスト / オーバーレイ`（`image / text / overlay`）に変更する。
- オーバーレイは従来どおり `hasLayout` が無い場合は disabled。

### FR-4: 全画面表示

- スライド表示エリア右下に四角枠の拡大ボタンを追加し、Fullscreen API でスライド表示エリアを全画面化する。
- 全画面中も左右ナビゲーション（画面上の ◀ ▶ ボタンおよびキーボード矢印）で移動できる。
- 全画面中は画像を画面内にフィット表示（`object-contain` 相当・黒背景）。オーバーレイモードでも全画面を維持し、ブロック位置が画像とずれないこと。
- 全画面中はボタンを終了アイコンに切替。`Esc` / 再クリックで解除（`fullscreenchange` で状態同期）。
- 既存の固定枠表示はそのまま残す。

## 非機能要件

- 変更は既存コンポーネント・ページ内に限定（新規ルート・スキーマ変更なし）
- i18n: 新規文言は `en.ts` / `ja.ts` 両方に追加
- 検証: `pnpm build`（型チェック含む）と既存 `vitest` が通ること

## 成果物

- `frontend/app/[user]/[slug]/page.tsx` — `generateMetadata` + 軽量メタルックアップ
- `frontend/components/deck-viewer.tsx` — 既定モード・タブ順・全画面
- `frontend/lib/i18n/dictionaries/{en,ja}.ts` — 全画面関連の文言

## Git 運用

- ブランチ作成 → コミット → push → `main` 向け PR 作成（`gh` 使用）
