# docs/ — ナレッジ & 参考資料

> [ルート README](../README.md) / [README_ja](../README_ja.md) に戻る。
> ここは調査・検討時のナレッジ集です。**実際の採用技術はルート README の「技術スタック」が正**で、本フォルダには採用見送り・参考のみの技術も含まれます。

## プロジェクト資料

| ファイル | 内容 |
|---|---|
| [REFERENCE.md](./REFERENCE.md) | ハッカソンルール・審査基準 |
| [IDEAS.md](./IDEAS.md) | アイデアメモ |
| [DRAWIO_PROMPT.md](./DRAWIO_PROMPT.md) | アーキテクチャ図 (draw.io XML) |

## 技術ナレッジ

| ファイル | 技術 |
|---|---|
| [AWS_DATABASE_KNOWLEDGE.md](./AWS_DATABASE_KNOWLEDGE.md) | Aurora DSQL / PostgreSQL / DynamoDB 比較 |
| [NEXTJS_KNOWLEDGE.md](./NEXTJS_KNOWLEDGE.md) | Next.js App Router |
| [DRIZZLE_KNOWLEDGE.md](./DRIZZLE_KNOWLEDGE.md) | Drizzle ORM（検討資料・**現状の実装では未使用**。DB アクセスは生 `pg` + `@aws-sdk/dsql-signer`） |
| [CLERK_KNOWLEDGE.md](./CLERK_KNOWLEDGE.md) | Clerk 認証 |
| [S3_KNOWLEDGE.md](./S3_KNOWLEDGE.md) | Amazon S3 |
| [SQS_KNOWLEDGE.md](./SQS_KNOWLEDGE.md) | Amazon SQS |
| [TRANSLATE_KNOWLEDGE.md](./TRANSLATE_KNOWLEDGE.md) | Amazon Translate |
| [PDF_PROCESSING_KNOWLEDGE.md](./PDF_PROCESSING_KNOWLEDGE.md) | PDF 処理 (PyMuPDF, Ghostscript) |
| [UPSTASH_KNOWLEDGE.md](./UPSTASH_KNOWLEDGE.md) | Upstash Redis（検討資料・**現状の実装では未配線**。アップロード上限は S3 presigned POST の `content-length-range` で強制） |
| [V0_KNOWLEDGE.md](./V0_KNOWLEDGE.md) | v0 (Vercel AI) |
| [SHADCN_KNOWLEDGE.md](./SHADCN_KNOWLEDGE.md) | shadcn/ui |
| [VERCEL_ISR_KNOWLEDGE.md](./VERCEL_ISR_KNOWLEDGE.md) | Vercel ISR / キャッシュ |
| [OGP_METADATA_KNOWLEDGE.md](./OGP_METADATA_KNOWLEDGE.md) | Next.js Metadata API (OGP) |
