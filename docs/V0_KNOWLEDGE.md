# v0 ナレッジまとめ

> ソース:
> - https://v0.app/docs/databases
> - https://v0.app/docs/full-stack-apps
> - https://v0.app/docs/api/platform/guides/environment-variables
> - https://community.vercel.com/t/my-experience-developing-a-full-stack-app-with-v0/6863
> - https://www.codecademy.com/article/v0-by-vercel-build-an-app-in-10-minutes
> - https://www.reddit.com/r/nextjs/comments/1jgbvx7/a_stepbystep_guide_to_v0dev_development/

---

## v0 とは

v0 は Vercel が提供する AI パワードの開発ツール。自然言語プロンプトから Next.js ベースのプロダクションレディなフルスタックアプリを生成できる。

### コア技術スタック
- **フレームワーク**: Next.js (App Router)
- **UI**: React + Tailwind CSS + shadcn/ui
- **バックエンド**: Server Actions / API Routes
- **AI モデル**: Claude (Anthropic) を使用
- **デプロイ**: Vercel にワンクリックデプロイ

---

## v0 でのフルスタック開発フロー

### 推奨ワークフロー (公式ドキュメントより)

1. **UI から始める** - コンポーネントレイアウトとデザインを作成
2. **データレイヤーを追加** - DB スキーマと API ルートを追加
3. **コア機能を実装** - 認証、CRUD、リアルタイム更新
4. **機能を拡張** - フィルタリング、検索等
5. **最適化・仕上げ** - キャッシュ、画像最適化、パフォーマンス

### ベストプラクティス
- 既存の generation を複製してロジックを追加する (UI とロジックを1つのプロンプトで混ぜない)
- 人気のある、ドキュメントが充実したライブラリを使う
- 詳細な実装指示を与えて、誤った仮定を避ける
- プロンプトは明確かつ具体的に書く

---

## データベース統合

### v0 のネイティブ統合 (Vercel Marketplace 経由)
- **Supabase** - PostgreSQL + Auth + リアルタイム
- **Neon** - サーバーレス PostgreSQL
- **Upstash** - Redis / Kafka
- **Vercel Blob** - オブジェクトストレージ

### セットアップ方法
1. プロジェクトメニュー `...` → Integrations から選択
2. または、チャットで「データベースを追加して」と指示
3. Marketplace の利用規約に同意
4. 環境変数が自動設定される

### SQL ベースの統合
- v0 は SQL を生成・実行可能
- テーブルの作成、更新、削除が可能

### ⚠️ H0 ハッカソンでの注意
ハッカソンでは **AWS Database (Aurora PostgreSQL / Aurora DSQL / DynamoDB)** が必須。v0 のネイティブ統合 (Supabase/Neon) ではなく、環境変数を手動設定して AWS DB に接続する必要がある。

---

## 環境変数の管理

### 設定方法
- プロジェクトメニュー `...` → Environment Variables
- チャットで統合追加時に自動設定される場合もある

### v0 SDK での管理 (Platform API)

```typescript
import { v0 } from 'v0-sdk'

// 環境変数の作成
await v0.projects.createEnvVars({
  projectId: 'your-project-id',
  environmentVariables: [
    { key: 'DATABASE_URL', value: 'postgresql://...' },
    { key: 'API_KEY', value: 'your-api-key' },
  ],
})

// 環境変数の取得
const envVars = await v0.projects.findEnvVars({
  projectId: 'your-project-id',
  decrypted: 'true',
})

// Upsert (作成 or 更新)
await v0.projects.createEnvVars({
  projectId: 'your-project-id',
  upsert: true,
  environmentVariables: [
    { key: 'DATABASE_URL', value: 'postgresql://newhost:5432/myapp' },
  ],
})
```

### 命名規則
- `NEXT_PUBLIC_` プレフィックス: クライアントサイドで使用する変数
- それ以外: サーバーサイドのみ (シークレット)

### H0 ハッカソンで必要な環境変数 (想定)
```
# Aurora PostgreSQL の場合
DATABASE_URL=postgresql://user:pass@aurora-endpoint:5432/dbname

# DynamoDB の場合
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=...

# Aurora DSQL の場合
DSQL_ENDPOINT=...
DSQL_REGION=...
```

---

## 実体験からの学び (Vercel Community / Codecademy)

### anshumanb (Vercel Staff) の体験談

**ワークアウトトラッカーアプリを v0 で構築した経験:**

1. 基本要件を1メッセージで伝えるだけで、v0 がフルプランを作成
2. 11回のイテレーションでフロントエンドが完成
3. バックエンド (Neon DB) 統合を指示 → スキーマ、ユーティリティ関数、API ルートを自動生成
4. DB セットアップスクリプトはローカルで実行が必要だった
5. Deploy ボタンで Vercel にデプロイ → 即座にライブ版をテスト可能

**重要な教訓:**
- v0 は ORM を使わない傾向がある (Drizzle 等を使いたい場合は明示的に指示)
- SQL マイグレーションも自動では使わない
- バックエンドロジックは必ず人間がレビューすべき
- セキュリティ面 (機密情報の漏洩) に注意
- Server Actions vs API Routes の使い分けを明示的に指示する

### Codecademy チュートリアルからの学び

**効果的なプロンプトの構造:**
```
Build a full-stack [アプリ名] web app in Next.js:
1. [画面1の説明]
2. [画面2の説明]
3. [画面3の説明]
4. [インタラクションの説明]
5. [デザイン要件]
```

**イテレーションのコツ:**
- 一度に全部作らず、段階的に改善
- 色・レイアウト・フォントサイズなど具体的に指示
- アクセシビリティ (フォーカスリング等) も明示的に要求

---

## v0 + AWS Database の接続パターン (H0 ハッカソン向け)

### パターン 1: Aurora PostgreSQL + Prisma/Drizzle

```typescript
// v0 に指示するプロンプト例:
// "Aurora PostgreSQL に接続する。Drizzle ORM を使い、
//  DATABASE_URL 環境変数から接続文字列を読む。"

// lib/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

export const db = drizzle(pool)
```

### パターン 2: DynamoDB + AWS SDK

```typescript
// v0 に指示するプロンプト例:
// "DynamoDB に接続する。@aws-sdk/client-dynamodb と
//  @aws-sdk/lib-dynamodb を使う。"

// lib/dynamodb.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
})

export const docClient = DynamoDBDocumentClient.from(client)
```

### パターン 3: Aurora DSQL

```typescript
// Aurora DSQL は PostgreSQL 互換なので、
// 基本的に Aurora PostgreSQL と同じ接続方法
// ただし IAM 認証トークンを使う場合がある

import { Signer } from '@aws-sdk/rds-signer'

const signer = new Signer({
  hostname: process.env.DSQL_ENDPOINT!,
  port: 5432,
  username: 'admin',
  region: process.env.AWS_REGION!,
})

const token = await signer.getAuthToken()
```

---

## v0 の制限事項と対策

| 制限 | 対策 |
|------|------|
| ネイティブ DB 統合は Supabase/Neon/Upstash のみ | 環境変数を手動設定して AWS SDK で接続 |
| ORM を使わない傾向 | プロンプトで明示的に Drizzle/Prisma を指定 |
| バックエンドのベストプラクティスが不十分な場合あり | 生成後にレビュー・修正 |
| クレジット消費が早い場合がある | 段階的に開発、不要な再生成を避ける |
| ローカル実行が必要な場合がある (DB セットアップ等) | "Add to Codebase" で npx コマンド取得 → ローカル開発 |

---

## ローカル開発への移行

1. v0 で "Add to Codebase" をクリック
2. `npx` コマンドが生成される
3. ローカルで実行 → プロジェクトがダウンロードされる
4. `npm install` → `npm run dev` で localhost:3000 で動作確認
5. 以降はローカルで自由に編集可能

### GitHub 連携
- v0 は GitHub 統合をサポート
- リポジトリと同期して開発可能
