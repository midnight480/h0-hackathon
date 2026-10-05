# Functional Design: unit-ocr（Textract OCR フォールバック）

## 目的
テキストレイヤーを持たない画像のみ PDF のページに対し、Amazon Textract（同期 `DetectDocumentText`）でテキスト＋位置情報を取得し、既存パイプライン（テキストパネル・オーバーレイ・翻訳）へ同一スキーマで接続する。

## 適用ルール
- **フォールバック条件**: ページ単位で「テキストレイヤー抽出結果（blocks ベース）が空」の場合のみ OCR。`extract_text_from_pdf()` と `extract_overlay_blocks()` の両方が空のページを対象とする。
- **有効化フラグ**: 環境変数 `OCR_ENABLED`（既定 `true`）。`false`/`0`/`no` で無効。
- **障害許容**: ページ単位で Textract 失敗時は warning ログのみで空のまま継続（デッキ全体を failed にしない）。

## データフロー
1. `extract_text_from_pdf()` → `texts`（現行どおり）
2. `extract_overlay_blocks()` → `layout`（現行どおり）
3. `apply_ocr_fallback(pdf_path, texts, layout)`（新規）
   - `texts[i]` が空かつ `layout[i]` が空のページ i について:
     - PyMuPDF でページを PNG レンダリング（`fitz.Matrix(2.0)` 程度。5MB 超なら段階的に縮小）
     - `textract.detect_document_text(Document={'Bytes': png})`
     - `BlockType == 'LINE'` を `(Top, Left)` 順にソート
     - オーバーレイブロック: `x0..y1` ← `Geometry.BoundingBox`（正規化済み）、`fs` ← `BoundingBox.Height`、`bg` ← `_sample_bg_color()` をレンダリング画像に適用、`t.original` ← LINE テキスト
     - テキスト: LINE を `"\n"` 連結 → `texts[i]`
4. 既存 `translate_texts` / `translate_overlay_blocks` / `update_deck_status` にそのまま渡す

## 座標系の整合
Textract BoundingBox はページに対する 0..1 正規化座標 → 既存スキーマ（ページ幅/高さで正規化）と同じ。`bg` サンプリングは `pix.width/width` スケールを掛ける既存ロジックをそのまま利用するため、OCR 用レンダリングのピクセル寸法とスケールを `_sample_bg_color` 呼び出し側で揃える。

## インターフェース
- `apply_ocr_fallback(pdf_path: str, texts: list[str], layout: list[list[dict]]) -> tuple[list[str], list[list[dict]]]`
- IAM: `textract:DetectDocumentText`（リソース `*`、Textract はリソースレベル権限非対応）
