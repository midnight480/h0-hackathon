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

## はじめ方

```bash
# AWS インフラのデプロイ
make deploy

# フロントエンド (v0 でスキャフォールド後)
# PROMPT.md の v0 プロンプトを参照
```

## ライセンス

MIT
