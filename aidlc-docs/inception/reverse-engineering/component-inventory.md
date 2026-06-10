# コンポーネント・インベントリ

## アプリケーション・パッケージ
- `src/lambda/processing` - PDFプロセッサー (Python)

## インフラストラクチャ・パッケージ
- `src/lib/dsql-stack.ts` - データベース定義
- `src/lib/storage-stack.ts` - ストレージ定義
- `src/lib/queue-stack.ts` - キュー定義
- `src/lib/lambda-stack.ts` - コンピュート定義
- `src/lib/translate-stack.ts` - 翻訳ポリシー定義
- `src/lib/vercel-webhook-stack.ts` - 外部連携定義

## 共有パッケージ/レイヤー
- `src/layers/ghostscript` - PDF変換用バイナリレイヤー

## 合計数
- **合計パッケージ数**: 7
- **アプリケーション**: 1
- **インフラストラクチャ**: 6
- **共有**: 1
- **テスト**: 0 (現状なし)
