# 要件定義: Issue #21 Textract OCR + Issue #22 Google Slides URL 取り込み

## Intent Analysis

- **User Request**: GitHub Issue #21（画像のみPDFへのAmazon Textract OCR対応）と Issue #22（Google Slides 共有URLからのデッキ取り込み）を実装する。Issue #23（SpeakerDeck）は ToS 調査結果のためクローズ済み。
- **Request Type**: Enhancement（新機能 ×2）
- **Scope Estimate**: Multiple Components（`src/lambda`・`src/lib` CDK・`frontend` Server Actions・UI）
- **Complexity Estimate**: Moderate

## 確認済み回答（ocr-url-import-questions.md）

- Q1 取得経路: **A) Google Drive API `files.export`（正式 API）**
- Q2 訂正 UI: **B) 訂正 UI も今回実装**
- Q3 Textract 方式: **A) 同期 `DetectDocumentText` をページ画像に逐次実行**
- Q4/Q5 拡張ルール: **適用しない**（Security Baseline / PBT ともに opt-out）

---

## FR-#22: Google Slides 共有URL取り込み

- **FR-22-1**: アップロードページに「Google Slides URL から取り込む」入力欄を追加する。PDF ドロップゾーンとは別入力とし、URL 指定時はファイルアップロード不要でデッキを作成できる。
- **FR-22-2**: 以下の URL 形式からプレゼン ID を抽出する。いずれにもマッチしない URL はバリデーションエラー。
  - `https://docs.google.com/presentation/d/<ID>/edit[#slide=...]`
  - `https://docs.google.com/presentation/d/<ID>/edit?usp=sharing`
  - `https://docs.google.com/presentation/d/<ID>/view`、`/pub`、`/present` 等
- **FR-22-3**: サーバー側（Server Action）で `GET https://www.googleapis.com/drive/v3/files/<ID>/export?mimeType=application/pdf&key=<GOOGLE_API_KEY>` を実行し、エクスポート PDF を取得する。
- **FR-22-4**: 取得内容を検証する。
  - レスポンスが 403/404 → 限定共有とみなし「リンクを知っている全員に変更してください」の趣旨の明確なエラー
  - 先頭バイトが `%PDF-` でない → エラー
  - サイズが `MAX_UPLOAD_BYTES` 超 → 既存のサイズ上限エラー
- **FR-22-5**: 検証済み PDF を `uploads/{deckId}/imported.pdf` として S3 に `PutObject` し、既存の `createDeckRecord` + `enqueueProcessing` を呼んで通常アップロードと同一パイプラインへ流す。
- **FR-22-6**: 取り込み実行前に「このコンテンツをインポート・公開する権利を持っている」旨の同意チェックボックスを必須化する（Google ToS「自分に属さないコンテンツのスクレイピング」禁止への対応）。
- **FR-22-7**: 環境変数 `GOOGLE_API_KEY`（Drive API 有効化済み GCP プロジェクトの API キー）を新設する。未設定時は URL 取り込み UI を非表示または無効化し、分かりやすいメッセージを返す。
- **FR-22-8**: タイトル未入力時は Drive API `files.get` の `name` をデッキタイトルの既定値に使う（取得できる場合）。

## FR-#21: Amazon Textract OCR フォールバック

- **FR-21-1**: 処理 Lambda で、ページのテキストレイヤー抽出結果が空／ほぼ空の場合のみ Textract を実行する（テキストレイヤー優先・OCR はフォールバック）。テキストレイヤーありの PDF の既存動作は変更しない。
- **FR-21-2**: OCR は同期 `DetectDocumentText` をページ単位で実行する。対象データは PyMuPDF でレンダリングした PNG バイト列（Textract は WebP 非対応のため、OCR 用に別途 PNG/JPEG を生成する。5MB 上限内）。
- **FR-21-3**: Textract `LINE` ブロックを既存オーバーレイスキーマへマップする。
  - `x0,y0,x1,y1`: `Geometry.BoundingBox`（既に正規化済み）
  - `fs`: LINE の `Height`（ページ高正規化と同義）
  - `bg`: 既存 `_sample_bg_color()` をページレンダリング画像に対して再利用
  - `t.original`: LINE テキスト
- **FR-21-4**: テキストパネル用 `texts` は OCR LINE を読み順（y0, x0）で連結して生成する。
- **FR-21-5**: 抽出結果は既存 `translate_texts()` / `translate_overlay_blocks()` に流し、翻訳・オーバーレイ・テキストパネルを従来どおり動作させる。
- **FR-21-6**: `src/lib/lambda-stack.ts` の処理 Lambda IAM ロールに `textract:DetectDocumentText` を追加する。
- **FR-21-7**: OCR の有効/無効を環境変数 `OCR_ENABLED`（既定 true）で切り替え可能にする。

## FR-#21b: OCR 結果の訂正 UI

- **FR-21b-1**: デッキ所有者のみが使える編集ページを新設する（`/@{user}/{slug}/edit`）。所有者以外・未ログインは notFound/リダイレクト。
- **FR-21b-2**: スライドごとに画像サムネイルと、OCR/抽出済みテキストの編集欄を表示する。
  - `layout` ブロックがあるスライド: ブロック単位の textarea（各ブロックの `t.original` を編集）
  - `layout` が空のスライド: スライド単位の textarea（`slide_texts` の `original` を編集）
- **FR-21b-3**: 保存時に Server Action が以下を行う。
  - 呼び出しユーザーがデッキ所有者であることを検証
  - ブロック編集の場合: 各ブロックの `t.original` を更新し、`decks.target_languages` の各言語へ Amazon Translate（`TranslateText`）で再翻訳して `t.<lang>` を更新。`slide_texts` の `original` はブロック本文の連結、各言語はブロック訳文の連結で再構成
  - スライド単位編集の場合: `slide_texts` の `original` を更新し、各 target language を再翻訳して保存
  - `slides.layout` と `slide_texts` を同一トランザクションで更新
  - デッキページの `revalidatePath`（および revalidateTag 相当）を実行
- **FR-21b-4**: 閲覧ページ（デッキ詳細）またはダッシュボードに、所有者のみ「テキストを編集」導線を追加する。
- **FR-21b-5**: フロントエンドの AWS 認証情報に `translate:TranslateText` 権限が必要（デプロイ前提として記録）。`@aws-sdk/client-translate` を依存に追加。

## NFR

- **NFR-1 コスト**: Textract はテキストレイヤーが空のページのみ実行（1ページあたり $0.0015 程度の DetectDocumentText 課金を最小化）。
- **NFR-2 セキュリティ**: URL 取り込みは認証済みユーザーのみ。外部取得は `www.googleapis.com` 固定（任意 URL フェッチの SSRF は発生させない）。fileKey は `uploads/{deckId}/` プレフィックス制約を維持。
- **NFR-3 タイムアウト**: Drive API fetch はタイムアウト設定（例: 30s）。PDF は `MAX_UPLOAD_BYTES` で事前打ち切り。
- **NFR-4 規約準拠**: Google 取り込みは公式 Drive API 経路のみ使用。SpeakerDeck 等の他サービス取り込みは対象外。

## 成果物（予定）

- `src/lambda/processing/handler.py`: OCR フォールバック処理追加
- `src/lib/lambda-stack.ts`: Textract IAM + `OCR_ENABLED` 環境変数
- `frontend/app/actions/upload.ts`（または新規 `import.ts`）: `importFromGoogleSlides` Server Action
- `frontend/app/upload/page.tsx`: URL 取り込み UI + 同意チェック
- `frontend/app/[user]/[slug]/edit/page.tsx`（新規）: テキスト訂正 UI
- `frontend/app/actions/`（新規 or 既存）: `updateSlideContent` Server Action（再翻訳含む）
- `frontend/lib/`: Google Slides URL パースユーティリティ + テスト
- `frontend/lib/i18n/dictionaries/{en,ja}.ts`: 新規 i18n キー
- `frontend/package.json`: `@aws-sdk/client-translate` 追加
- 環境変数: `GOOGLE_API_KEY`（Vercel env への追加はユーザー側作業）

## デプロイ前提（ユーザー側作業）

1. GCP プロジェクトで Drive API を有効化し API キー発行 → `GOOGLE_API_KEY` を `frontend/.env`・`.env.local`・Vercel env に設定
2. フロントエンド用 IAM（Vercel が使う AWS キー）に `translate:TranslateText` を付与
3. `cd src && npm run deploy`（CDK: Textract IAM 権限反映）
