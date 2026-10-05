# Execution Plan: Issue #21 OCR + Issue #22 Google Slides URL 取り込み

## Detailed Analysis Summary

### Transformation Scope (Brownfield)
- **Transformation Type**: Multiple components（処理 Lambda・CDK・frontend Server Actions・UI）
- **Primary Changes**:
  - `src/lambda/processing/handler.py` に Textract OCR フォールバック追加
  - `src/lib/lambda-stack.ts` に `textract:DetectDocumentText` IAM + `OCR_ENABLED` 環境変数
  - `frontend` に Google Slides URL 取り込み（Server Action + アップロード UI）
  - `frontend` に所有者限定のテキスト訂正ページ + 再翻訳 Server Action（`@aws-sdk/client-translate` 新規依存）
- **Related Components**: `app/actions/upload.ts`（再利用）、`app/[user]/[slug]/page.tsx`（編集導線）、`lib/i18n`（辞書）

### Change Impact Assessment
- **User-facing changes**: Yes — アップロード画面に URL 入力追加、デッキ所有者向け編集ページ新設
- **Structural changes**: No — 既存 S3→SQS→Lambda→DSQL パイプラインを再利用
- **Data model changes**: No — 既存 `slides.layout` / `slide_texts` スキーマをそのまま使用
- **API changes**: Yes（内部）— Server Action `importFromGoogleSlides` / `updateSlideContent` 新設
- **NFR impact**: Yes — Textract 課金（フォールバックのみ）、外部 fetch タイムアウト/サイズ上限、Translate 権限

### Component Relationships
- **Primary Components**: `src/lambda/processing`（OCR）、`frontend`（取り込み/訂正）
- **Infrastructure Components**: `src/lib/lambda-stack.ts`（IAM 権限追加のみ）
- **Shared Components**: `lib/data.ts` の `SlideBlock` スキーマ（変更なし・再利用）
- **Dependent Components**: `components/deck-viewer.tsx`（layout/slide_texts の消費側・変更不要）

### Risk Assessment
- **Risk Level**: Medium（外部サービス2系統の新規連携、Lambda 処理追加、所有者向け新規編集機能）
- **Rollback Complexity**: Easy〜Moderate（OCR_ENABLED=false で無効化可能、URL取り込みは UI 非表示化で退避可能）
- **Testing Complexity**: Moderate（URL パース・Textract マッピングは単体テスト可能、E2E は実デッキ依存）

## Phases to Execute

### 🔵 INCEPTION PHASE
- [x] Workspace Detection (COMPLETED)
- [x] Reverse Engineering (COMPLETED・既存成果物流用)
- [x] Requirements Analysis (COMPLETED)
- [ ] User Stories - **SKIP**
  - **Rationale**: Issue の受け入れ条件＋確認質問で要件が確定済み。新規ペルソナなし
- [x] Workflow Planning (IN PROGRESS)
- [ ] Application Design - **SKIP**
  - **Rationale**: 既存コンポーネント境界内の拡張＋既存パイプライン再利用。新規サービス層なし
- [ ] Units Generation - **SKIP**
  - **Rationale**: ユニット分割は下記の3ユニットで本計画内に直接定義

### 🟢 CONSTRUCTION PHASE（3ユニット・順次実行）
- [ ] Functional Design - **EXECUTE（軽量・unit-ocr / unit-text-correction のみ）**
  - **Rationale**: Textract LINE→オーバーレイブロック変換と訂正→再翻訳の整合ルールは新規ビジネスロジックのため簡易設計を残す。unit-gslides-import は定型のためスキップ
- [ ] NFR Requirements - **SKIP**
  - **Rationale**: 要件書の NFR セクションで確定済み
- [ ] NFR Design - **SKIP**
- [ ] Infrastructure Design - **SKIP**
  - **Rationale**: IAM ステートメント追加と環境変数のみ
- [ ] Code Generation - **EXECUTE**（ALWAYS・ユニットごと）
- [ ] Build and Test - **EXECUTE**（ALWAYS）

### 🟡 OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER

## Unit 定義・実行順序

| # | Unit | 対象 | 依存 |
|---|---|---|---|
| 1 | `unit-ocr` | `src/lambda/processing/handler.py`、`src/lib/lambda-stack.ts` | なし |
| 2 | `unit-gslides-import` | `frontend/app/actions/import.ts`（新規）、`frontend/lib/gslides.ts` + test、`frontend/app/upload/page.tsx`、i18n | なし（unit-ocr と並行可だが順次で実行） |
| 3 | `unit-text-correction` | `frontend/app/[user]/[slug]/edit/page.tsx`（新規）、`frontend/app/actions/slide-text.ts`（新規）、編集導線、i18n、`@aws-sdk/client-translate` | なし（OCR と独立。layout スキーマは既存） |

## Success Criteria
- **Primary Goal**: 画像のみ PDF でテキスト抽出・翻訳・オーバーレイが動作し、OCR 結果を所有者が訂正できる。Google Slides 共有URL からデッキを取り込める
- **Key Deliverables**: 要件書「成果物」に列挙のファイル一式
- **Quality Gates**: `pnpm build`（frontend）、`npm run build`（src）、vitest、Python 側は構文チェック＋可能な範囲のローカル検証
- **Integration**: 実デプロイ・実 OCR / Drive API 検証はユーザー側作業（`GOOGLE_API_KEY`・IAM・CDK deploy）
