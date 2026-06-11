# コード構造

## ビルドシステム
- **タイプ**: npm (CDK用), pip (Lambda用)
- **設定**: `package.json`, `requirements.txt`, `Makefile`

## 主要クラス/モジュール
- **CDK Stacks** (`src/lib/`):
    - `dsql-stack.ts`: Aurora DSQL クラスターの定義
    - `lambda-stack.ts`: プロセッサーLambdaとSQSトリガーの定義
    - `queue-stack.ts`: SQS キューとデッドレターキューの定義
    - `storage-stack.ts`: S3 バケットとイベント通知の定義
    - `translate-stack.ts`: 翻訳に必要なIAMポリシーの定義
    - `vercel-webhook-stack.ts`: Vercel キャッシュ無効化用 Webhook の設定
- **Lambda Handler** (`src/lambda/processing/handler.py`):
    - `main`: SQSイベントのエントリポイント
    - `convert_pdf_to_images`: `pdf2image` を使用した変換
    - `extract_text_from_pdf`: `fitz (PyMuPDF)` を使用した抽出
    - `translate_texts`: `boto3` を使用した翻訳

### 既存ファイル一覧
- `src/bin/hiravi-cdk.ts` - CDK アプリのエントリポイント
- `src/lib/*.ts` - インフラ定義ファイル
- `src/lambda/processing/handler.py` - メインのロジック
- `src/lambda/processing/requirements.txt` - Python 依存関係
- `Makefile` - ビルドとデプロイの自動化
- `PROMPT.md` - プロジェクトの全体構想とハッカソン提出用ドラフト

## デザインパターン
### Event-Driven Architecture
- **場所**: S3 → SQS → Lambda
- **目的**: アップロード処理の非同期化とスケーラビリティの確保。
- **実装**: S3イベント通知をSQSに送り、Lambdaで消費する。

### Event Sourcing (計画)
- **場所**: DBスキーマ設計 (`PROMPT.md` 参照)
- **目的**: DSQLのOCC（楽観的排他制御）コンフリクトを避け、監査ログを保持する。
- **実装**: 状態変更を `deck_events` テーブルへの INSERT として記録する。

## 重要な依存関係
- **AWS CDK (v2)**: インフラ管理
- **boto3**: AWS SDK for Python (S3, Translate, SQS)
- **pdf2image**: PDFから画像への変換 (Ghostscript依存)
- **PyMuPDF (fitz)**: PDFテキスト抽出
- **psycopg2 (予定)**: Aurora DSQL (PostgreSQL) 接続
