# API ドキュメント

## 内部 API (Lambda ハンドラー)
### `main(event, context)`
- **引数**: SQS イベントレコード
- **目的**: キューから届いたメッセージを順次処理する
- **フロー**: ダウンロード → 画像変換 → テキスト抽出 → 翻訳 → DB更新 → Webhook呼び出し

## データモデル (Aurora DSQL 予定)
### `users`
- **フィールド**: `id` (UUID), `clerk_id` (TEXT), `username` (TEXT), `email` (TEXT), etc.
- **関係**: 1ユーザーが複数の `decks` を所有する。

### `decks`
- **フィールド**: `id` (UUID), `user_id` (UUID), `slug` (TEXT), `title` (TEXT), `processing_status` (TEXT), etc.
- **バリデーション**: `user_id` と `slug` の組み合わせで一意。

### `slides`
- **フィールド**: `id` (UUID), `deck_id` (UUID), `page_number` (INTEGER), `image_key` (TEXT), `original_text` (TEXT)
- **関係**: `decks` に属するページ。

### `translation_events`
- **フィールド**: `slide_id` (UUID), `target_language` (TEXT), `translated_text` (TEXT), etc.
- **役割**: 各スライドの各言語への翻訳結果を保持。
