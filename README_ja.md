# Hiravi 🌐

**スライド共有 + 自動多言語翻訳プラットフォーム**

> H0 Hackathon 2026 — Track 3: Million-scale Global App

## Hiravi とは？

PDF スライドをアップロードするだけで、75言語以上に自動翻訳された Web スライドショーが完成。元のスライド画像は一切改変せず、翻訳は「参考レイヤー」として別表示します。

**名前の由来**: ひらり（紙が軽やかにめくれる様）+ visual + 開く（hiraku）

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js (App Router) via v0, Tailwind CSS, shadcn/ui |
| ホスティング | Vercel (Edge CDN + ISR) |
| データベース | **Aurora DSQL** (マルチリージョン Active-Active) |
| 認証 | Clerk (OAuth, MFA, セッション管理) |
| ストレージ | Amazon S3 (バージョニング、暗号化) |
| キュー | Amazon SQS + Dead Letter Queue |
| コンピュート | AWS Lambda (Python 3.12 + Ghostscript) |
| 翻訳 | Amazon Translate (75言語対応) |
| レート制限 | Upstash Redis (HyperLogLog) |
| IaC | AWS CDK (TypeScript, 6スタック) |

## リポジトリ構成

```
├── PROMPT.md              # プロジェクト仕様書
├── docs/                  # ナレッジ・参考資料
│   ├── DRAWIO_PROMPT.md   # アーキテクチャ図 (draw.io XML)
│   ├── REFERENCE.md       # ハッカソンルール・審査基準
│   └── *_KNOWLEDGE.md    # 技術リファレンス
├── src/                   # AWS CDK インフラコード
│   ├── bin/               # CDK アプリエントリポイント
│   ├── lib/               # スタック定義 (6スタック)
│   ├── lambda/            # Lambda 関数コード (Python)
│   └── layers/            # Lambda レイヤー (Ghostscript)
├── .kiro/                 # AI-DLC ワークフロー
├── CLAUDE.md              # Claude エージェントルール
├── AGENTS.md              # Codex エージェントルール
└── GEMINI.md              # Gemini エージェントルール
```

## 設計方針

1. **イベントソーシング** — 状態変更は全て INSERT-only。Aurora DSQL の OCC 競合を回避
2. **翻訳は別レイヤー** — 元スライドは神聖。翻訳は参考情報として表示
3. **非同期処理パイプライン** — S3 → SQS → Lambda で PDF 処理をデカップリング
4. **マルチリージョン Active-Active** — Aurora DSQL が東京⇔バージニア間で自動レプリケーション

## はじめ方

```bash
# AWS インフラのデプロイ
cd src && npm install && npx cdk deploy --all

# フロントエンド (v0 でスキャフォールド後)
# PROMPT.md の v0 プロンプトを参照
```

## ライセンス

MIT

---

[H0: Hack the Zero Stack](https://h01.devpost.com/) — Vercel v0 + AWS Databases で構築。

**#H0Hackathon**
