# AWS Database ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://docs.aws.amazon.com/aurora-dsql/latest/userguide/what-is-aurora-dsql.html
> - https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-migration-guide.html
> - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
> - https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraPostgreSQL.html

---

## 3つの選択肢の比較

| 特性 | Aurora PostgreSQL | Aurora DSQL | DynamoDB |
|------|------------------|-------------|----------|
| **タイプ** | リレーショナル (SQL) | 分散リレーショナル (SQL) | NoSQL (Key-Value/Document) |
| **互換性** | PostgreSQL 完全互換 | PostgreSQL 16 互換 (制限あり) | 独自 API |
| **スケーリング** | Read Replica で水平読取 | サーバーレス自動スケール | サーバーレス自動スケール |
| **可用性 SLA** | 99.99% | 99.99% (単一リージョン) / 99.999% (マルチリージョン) | 99.99% / 99.999% (Global Tables) |
| **レイテンシ** | 低レイテンシ | 低レイテンシ | 一桁ミリ秒 |
| **トランザクション** | 完全 ACID | ACID (OCC) | ACID (TransactWriteItems) |
| **管理** | マネージド (プロビジョニング必要) | フルサーバーレス | フルサーバーレス |
| **コスト** | インスタンスベース | 使用量ベース | 使用量ベース (On-Demand) |
| **最適なユースケース** | 複雑なクエリ、JOIN多用 | グローバル分散、マルチリージョン | 高スループット、シンプルアクセスパターン |

---

## 1. Amazon Aurora PostgreSQL

### 概要
- PostgreSQL 完全互換のマネージドリレーショナル DB
- 標準 PostgreSQL の最大5倍のスループット
- 最大15の Read Replica
- 自動バックアップ、ポイントインタイムリカバリ
- HIPAA、FedRAMP HIGH 対応

### 特徴
- **Drop-in replacement**: 既存の PostgreSQL アプリをそのまま移行可能
- **ストレージ自動拡張**: 最大 128 TiB
- **マルチ AZ**: 3つの AZ にデータ複製
- **Global Database**: 最大5リージョンにリードレプリカ

### Next.js からの接続パターン

```typescript
// lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // コネクションプール
})

export async function query(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows
  } finally {
    client.release()
  }
}
```

```typescript
// Drizzle ORM を使う場合
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

export const db = drizzle(pool, { schema })
```

### H0 ハッカソンでの適性
- **Track 1 (B2C)**: EC サイト等の複雑なリレーション → ◎
- **Track 2 (B2B)**: 金融・ヘルスケア等の複雑なクエリ → ◎
- **Track 3 (Million-scale)**: Read Replica でスケール可能だが DSQL の方が適切
- **Track 4 (Open)**: 汎用的に使える → ○

---

## 2. Amazon Aurora DSQL

### 概要
- **サーバーレス分散リレーショナル DB**
- PostgreSQL 16 互換
- インフラ管理不要、自動スケール
- Active-Active マルチリージョン
- 99.999% マルチリージョン可用性

### 主要な特徴
- **サーバーレス**: プロビジョニング不要、ゼロスケール対応
- **分散アーキテクチャ**: 3 AZ に自動複製
- **マルチリージョン**: Active-Active で両リージョンから読み書き可能
- **PostgreSQL 互換**: 標準ドライバー、ORM が使用可能
- **自動メンテナンス**: VACUUM 不要、パッチ不要

### ⚠️ PostgreSQL との重要な違い

| PostgreSQL の機能 | Aurora DSQL での対応 |
|---|---|
| 複数データベース | 1クラスタ = 1 DB (`postgres`) のみ。スキーマで分離 |
| TRUNCATE | `DELETE FROM table_name` を使用 |
| CREATE INDEX | `CREATE INDEX ASYNC` (ノンブロッキング) |
| 外部キー制約 | アプリケーション層で実装 |
| 一時テーブル | CTE (`WITH` 句) またはサブクエリ |
| トリガー | アプリケーション層 / EventBridge |
| PL/pgSQL | SQL 関数のみ。複雑なロジックは Lambda へ |
| 悲観的ロック (SELECT FOR UPDATE) | 楽観的同時実行制御 (OCC) |
| トランザクション分離レベル | Repeatable Read 固定 |

### トランザクション制約
- DDL と DML は別トランザクション
- 1トランザクションに DDL は1文のみ
- 1トランザクションで変更可能な行数: **最大 3,000 行**
- 接続タイムアウト: 1時間

### OCC (楽観的同時実行制御)
- ロックを取得せずトランザクション実行
- コミット時に競合検出 → シリアライゼーションエラー
- **リトライロジックの実装が必須**
- デッドロックは発生しない

```typescript
// リトライパターン
async function executeWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (error.code === '40001' && i < maxRetries - 1) {
        // シリアライゼーションエラー → リトライ
        await new Promise(r => setTimeout(r, Math.random() * 100))
        continue
      }
      throw error
    }
  }
}
```

### リージョン可用性 (東京あり)
- ap-northeast-1 (東京) ✅
- ap-northeast-3 (大阪) ✅
- マルチリージョン: 東京 + 大阪 + ソウル のセット

### Next.js からの接続

```typescript
// lib/dsql.ts
import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Pool } from 'pg'

async function getConnection() {
  const signer = new DsqlSigner({
    hostname: process.env.DSQL_ENDPOINT!,
    region: process.env.AWS_REGION!,
  })
  
  const token = await signer.getDbConnectAdminAuthToken()
  
  const pool = new Pool({
    host: process.env.DSQL_ENDPOINT,
    port: 5432,
    user: 'admin',
    password: token,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  
  return pool
}
```

### H0 ハッカソンでの適性
- **Track 1 (B2C)**: サーバーレスで運用コスト低 → ○
- **Track 2 (B2B)**: 外部キーなしが制約 → △
- **Track 3 (Million-scale)**: マルチリージョン Active-Active → ◎◎ (最適)
- **Track 4 (Open)**: サーバーレス + グローバル → ◎

### スキーマ設計のベストプラクティス
- UUID をプライマリキーに使用 (分散に最適)
- 外部キーの代わりにアプリ層でバリデーション
- 3,000行制限を考慮したバッチ処理設計
- リトライロジックを全 DB 操作に実装

---

## 3. Amazon DynamoDB

### 概要
- **サーバーレス NoSQL データベース**
- Key-Value + Document モデル
- 一桁ミリ秒のレイテンシ (任意のスケール)
- 完全マネージド、ゼロメンテナンス
- Global Tables でマルチリージョン

### コアコンセプト

```
テーブル
├── パーティションキー (PK) - 必須
├── ソートキー (SK) - オプション
├── 属性 (Attributes) - スキーマレス
├── グローバルセカンダリインデックス (GSI)
└── ローカルセカンダリインデックス (LSI)
```

### データモデリングの原則
- **Single Table Design**: 1テーブルに複数エンティティを格納
- **非正規化**: JOIN がないため、読み取りパターンに合わせてデータを複製
- **アクセスパターン駆動**: 先にクエリパターンを決め、それに合わせてキー設計

### 主要な操作

| 操作 | 説明 |
|------|------|
| PutItem | アイテム作成/上書き |
| GetItem | PK (+SK) で1件取得 |
| Query | PK で絞り込み + SK で範囲指定 |
| Scan | テーブル全件走査 (非推奨) |
| UpdateItem | 部分更新 |
| DeleteItem | 削除 |
| BatchWriteItem | 最大25件の一括書き込み |
| TransactWriteItems | ACID トランザクション (最大100件) |

### 容量モード
- **On-Demand**: 使った分だけ課金、自動スケール、ゼロスケール対応
- **Provisioned**: RCU/WCU を事前設定、Auto Scaling 可能
- **Always Free Tier**: 25GB ストレージ + 25 WCU + 25 RCU

### Next.js からの接続

```typescript
// lib/dynamodb.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

// 使用例: アイテム作成
export async function createItem(tableName: string, item: Record<string, any>) {
  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: item,
  }))
}

// 使用例: クエリ
export async function queryItems(
  tableName: string,
  pk: string,
  pkValue: string,
  sk?: { condition: string; value: string }
) {
  const params: any = {
    TableName: tableName,
    KeyConditionExpression: `${pk} = :pk`,
    ExpressionAttributeValues: { ':pk': pkValue },
  }
  if (sk) {
    params.KeyConditionExpression += ` AND ${sk.condition}`
    params.ExpressionAttributeValues[':sk'] = sk.value
  }
  const result = await docClient.send(new QueryCommand(params))
  return result.Items || []
}
```

### Single Table Design の例 (EC サイト)

```
PK              | SK                  | データ
----------------|---------------------|------------------
USER#123        | PROFILE             | { name, email, ... }
USER#123        | ORDER#2024-001      | { total, status, ... }
USER#123        | ORDER#2024-002      | { total, status, ... }
PRODUCT#abc     | METADATA            | { name, price, ... }
PRODUCT#abc     | REVIEW#USER#123     | { rating, comment, ... }
ORDER#2024-001  | ITEM#PRODUCT#abc    | { quantity, price, ... }
```

### H0 ハッカソンでの適性
- **Track 1 (B2C)**: EC、リアルタイムアプリ → ◎
- **Track 2 (B2B)**: 複雑なリレーションには不向き → △
- **Track 3 (Million-scale)**: ゲーム、リーダーボード → ◎◎ (最適)
- **Track 4 (Open)**: シンプルなアクセスパターンなら → ○

### DynamoDB Streams + Lambda
```
DynamoDB テーブル → DynamoDB Streams → Lambda → 後続処理
```
- リアルタイムイベント処理
- 集計・分析
- 通知送信

---

## トラック別おすすめ DB 選定

| Track | 第1候補 | 理由 |
|-------|---------|------|
| Track 1: B2C | DynamoDB or Aurora PostgreSQL | EC なら DynamoDB (スケール)、複雑なら Aurora |
| Track 2: B2B | Aurora PostgreSQL | 複雑なリレーション、レポーティング |
| Track 3: Million-scale | Aurora DSQL or DynamoDB | DSQL (マルチリージョン SQL)、DynamoDB (ゲーム) |
| Track 4: Open | Aurora DSQL | サーバーレス + PostgreSQL 互換 + スケール |

---

## 審査基準との対応

### Technical Implementation で高評価を得るには
- **Aurora PostgreSQL**: 正規化されたスキーマ設計、インデックス戦略、コネクションプーリング
- **Aurora DSQL**: OCC リトライ実装、UUID キー設計、マルチリージョン構成図
- **DynamoDB**: Single Table Design、GSI 設計、アクセスパターン文書化

### Impact & Real-world Applicability で高評価を得るには
- スケーラビリティを示すアーキテクチャ図
- 本番運用を想定したエラーハンドリング
- コスト効率の説明

---

## 環境変数テンプレート

```bash
# Aurora PostgreSQL
DATABASE_URL=postgresql://username:password@cluster-endpoint.region.rds.amazonaws.com:5432/dbname

# Aurora DSQL
DSQL_ENDPOINT=your-cluster-id.dsql.region.on.aws
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# DynamoDB
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
DYNAMODB_TABLE_NAME=my-app-table
```

---

## 参考ドキュメントリンク

| サービス | ドキュメント |
|----------|-------------|
| Aurora DSQL | https://docs.aws.amazon.com/aurora-dsql/latest/userguide/what-is-aurora-dsql.html |
| Aurora DSQL 移行ガイド | https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-migration-guide.html |
| Aurora DSQL SQL互換性 | https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility.html |
| Aurora PostgreSQL | https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraPostgreSQL.html |
| DynamoDB 開発者ガイド | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html |
| DynamoDB ベストプラクティス | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html |
| DynamoDB コアコンポーネント | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html |
