# 要件確認質問（Issue #21 OCR / Issue #22 Google Slides URL 取り込み）

回答確定済み（2026-10-05、AskUserQuestion + 確認済み）。

## Question 1: Google Slides PDF の取得経路（#22）

Issue #22 のサーバー側取得をどの経路で実装しますか？

A) **Google Drive API `files.export`（正式 API）** — `GET /drive/v3/files/{id}/export?mimeType=application/pdf&key={API_KEY}`。Google APIs ToS に完全準拠。Google Cloud プロジェクトで Drive API 有効化 + API キー発行の事前設定が必要。権限エラーは 403/404 で明確に検出可能
B) **`docs.google.com/presentation/d/<id>/export/pdf` を直接 fetch** — 認証情報の設定不要。robots.txt 上は `Allow: /presentation` の範囲内で ToS 条項には抵触しないが、非公式エンドポイントのため仕様変更リスクあり。限定公開時は HTML が返るのでマジックバイトで判定
C) **A を主経路、失敗時に B へフォールバック** — 冗長性は高いが実装・テスト対象が増える
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2: OCR 訂正 UI のスコープ（#21）

Issue #21 の「ユーザーが OCR 結果を確認・訂正できる」要件の実装スコープは？

A) **今回は OCR 抽出のみ** — Textract で抽出したテキストをテキストパネル・オーバーレイ・翻訳パイプラインに流すまでを実装。訂正 UI（編集画面＋再翻訳）は別 Issue として後続対応（受け入れ条件の「訂正できる」項目を Issue 側で分離・繰り越し）
B) **訂正 UI も今回実装** — デッキ所有者がスライドテキストを編集できる画面を新規追加し、訂正後テキストの再翻訳まで含める（工数は大きい。編集 API＋編集 UI＋再翻訳経路が新規スコープ）
X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 3: Textract の呼び出し方式（#21）

処理 Lambda 内での Textract 実行方式は？

A) **同期 `DetectDocumentText` をページ画像に対して逐次実行（推奨）** — 既に各ページを PyMuPDF でレンダリングしているため、PNG/JPEG（5MB 以下）をそのまま渡せる。単一 Lambda 呼び出し内で完結し、LINE ブロックの BoundingBox を既存オーバーレイスキーマへ直接マップ可能
B) **非同期 `StartDocumentTextDetection` で PDF 一括処理** — ページ数が多いデッキ向きだが、ジョブ完了通知（SNS/ポーリング）と状態管理が別途必要でパイプラインが複雑化
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4: セキュリティ拡張ルール

このプロジェクトに Security Baseline 拡張ルールを適用しますか？

A) Yes — SECURITY ルールをブロッキング制約として適用
B) No — SECURITY ルールをスキップ
X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 5: Property-Based Testing 拡張ルール

Property-Based Testing（PBT）ルールを適用しますか？

A) Yes — すべての PBT ルールをブロッキング制約として適用
B) Partial — 純粋関数とシリアライゼーションのラウンドトリップのみ適用
C) No — PBT ルールをスキップ
X) Other (please describe after [Answer]: tag below)

[Answer]: C
