# Functional Design: unit-text-correction（テキスト訂正 UI）

## 目的
デッキ所有者が抽出済みテキスト（OCR 結果含む）を確認・訂正し、訂正後テキストを既存翻訳対象言語へ再翻訳して保存できるようにする。

## 画面・導線
- ルート: `app/[user]/[slug]/edit/page.tsx`（`/@{user}/{slug}/edit`）
- 認可: `auth().userId === deck.user_id` のみ許可。それ以外は `notFound()`（存在秘匿）
- 導線: デッキ詳細ページに所有者のみ表示の「テキストを編集」ボタン（`DeckViewer` に `isOwner` 等のフラグを追加）

## 編集モデル
- `layout` が 1 ブロック以上あるスライド: **ブロック単位編集**。各ブロックの `t.original` を textarea で編集
- `layout` が空のスライド: **スライド単位編集**。`slide_texts` の `original` を 1 つの textarea で編集
- 保存はスライド単位（「このスライドを保存」ボタン）→ Translate コストと失敗範囲を限定

## Server Action: `updateSlideText`
入力: `{ deckId, slideId, blocks?: string[] | null, text?: string }`

1. 認証 + `decks.user_id === userId` 検証、`decks.target_languages` 取得
2. `blocks` 指定時:
   - `slides.layout` を読み、各ブロックの `t.original` を入力で上書き（index 対応。ブロック数不一致はエラー）
   - 各ブロックの `t.original` を各 target language に `TranslateText` で翻訳 → `t.<lang>` 更新（数字・記号のみは既存ルール同様スキップ）
   - `slide_texts` の `original` = ブロック原文の `"\n"` 連結、各言語 = ブロック訳文の連結（UPSERT: DELETE+INSERT or UPDATE）
   - `slides.layout` を更新
3. `text` 指定時: `slide_texts` の `original` 更新 + 各言語を再翻訳して保存
4. 全更新を単一トランザクションで実行。`revalidatePath` でデッキページを無効化

## 依存追加
- `frontend`: `@aws-sdk/client-translate`（他の AWS SDK と同系バージョン `^3.1146.0`）
- フロントエンド AWS 認証情報に `translate:TranslateText` 権限が必要（デプロイ前提）
