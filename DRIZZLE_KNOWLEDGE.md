# Drizzle ORM ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://orm.drizzle.team/docs/get-started/postgresql-new
> - https://orm.drizzle.team/docs/column-types/pg
> - https://orm.drizzle.team/docs/sql-schema-declaration
> - https://orm.drizzle.team/docs/select
> - https://orm.drizzle.team/docs/insert
> - https://orm.drizzle.team/docs/transactions

---

## Drizzle ORM とは

TypeScript ファーストの ORM。SQL に近い API で型安全なクエリを書ける。Prisma より軽量で、生 SQL に近い感覚で使える。

### Hiravi での利用方針
- Aurora DSQL (PostgreSQL 16 互換) に接続
- スキーマ定義 → `drizzle-kit push` で DB に反映 (マイグレーションファイル不要)
- 外部キー制約なし (Aurora DSQL の制約) → アプリ層でリレーション検証
- OCC リトライロジックを全 DB 操作に実装

---

## セットアップ

### インストール

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

### 接続設定 (Aurora DSQL)

```typescript
// lib/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { DsqlSigner } from '@aws-sdk/dsql-signer'
import * as schema from './schema'

async function createPool() {
  const signer = new DsqlSigner({
    hostname: process.env.DSQL_ENDPOINT!,
    region: process.env.AWS_REGION || 'ap-northeast-1',
  })

  const token = await signer.getDbConnectAdminAuthToken()

  return new Pool({
    host: process.env.DSQL_ENDPOINT,
    port: 5432,
    user: 'admin',
    password: token,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    max: 10,
  })
}

// シングルトンパターン (サーバーレス環境向け)
let pool: Pool | null = null

async function getPool() {
  if (!pool) {
    pool = await createPool()
  }
  return pool
}

export async function getDb() {
  const p = await getPool()
  return drizzle(p, { schema })
}
```

### drizzle.config.ts

```typescript
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

## スキーマ定義 (Hiravi 用)

### PostgreSQL カラム型マッピング

| SQL 型 | Drizzle 関数 | 用途 |
|--------|-------------|------|
| UUID | `uuid()` | プライマリキー |
| TEXT | `text()` | 可変長文字列 |
| TEXT[] | `text().array()` | タグ、翻訳先言語リスト |
| INTEGER | `integer()` | ページ番号、スライド数 |
| BOOLEAN | `boolean()` | フラグ |
| TIMESTAMPTZ | `timestamp({ withTimezone: true })` | 日時 |
| JSONB | `jsonb()` | メタデータ |

### Hiravi スキーマ定義

```typescript
// src/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

// ユーザー
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// スライドデッキ
export const decks = pgTable('decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  originalLanguage: text('original_language').notNull().default('ja'),
  targetLanguages: text('target_languages').array().notNull().default(['en']),
  category: text('category'),
  fileKey: text('file_key').notNull(),
  slideCount: integer('slide_count').notNull().default(0),
  tags: text('tags').array().default([]),
  processingStatus: text('processing_status').notNull().default('pending'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('decks_user_slug_idx').on(table.userId, table.slug),
  index('decks_user_id_idx').on(table.userId),
  index('decks_category_idx').on(table.category),
  index('decks_processing_status_idx').on(table.processingStatus),
])

// 閲覧イベント (INSERT-only)
export const deckViews = pgTable('deck_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull(),
  viewerId: uuid('viewer_id'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('deck_views_deck_id_idx').on(table.deckId),
])

// デッキステータスイベント (イベントソーシング)
export const deckEvents = pgTable('deck_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull(),
  eventType: text('event_type').notNull(),
  version: integer('version'),
  actorId: uuid('actor_id').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('deck_events_deck_id_idx').on(table.deckId),
])

// スライドページ
export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull(),
  version: integer('version').notNull().default(1),
  pageNumber: integer('page_number').notNull(),
  imageKey: text('image_key').notNull(),
  originalText: text('original_text'),
}, (table) => [
  uniqueIndex('slides_deck_version_page_idx').on(table.deckId, table.version, table.pageNumber),
])

// 翻訳イベント (イベントソーシング)
export const translationEvents = pgTable('translation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  slideId: uuid('slide_id').notNull(),
  targetLanguage: text('target_language').notNull().default('en'),
  eventType: text('event_type').notNull(),
  translatedText: text('translated_text'),
  actorId: uuid('actor_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('translation_events_slide_id_idx').on(table.slideId, table.targetLanguage),
])

// いいねイベント (INSERT-only)
export const deckLikes = pgTable('deck_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull(),
  userId: uuid('user_id'),
  likedAt: timestamp('liked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('deck_likes_deck_id_idx').on(table.deckId),
])
```

---

## クエリパターン

### SELECT

```typescript
import { eq, desc, sql, and, ilike } from 'drizzle-orm'
import { decks, users, deckLikes } from './schema'

// 単純な取得
const deck = await db.select().from(decks).where(eq(decks.id, deckId))

// JOIN なし (Aurora DSQL は外部キーなし) → 2回クエリ
const deck = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1)
const author = await db.select().from(users).where(eq(users.id, deck[0].userId)).limit(1)

// ILIKE 検索
const results = await db.select().from(decks)
  .where(ilike(decks.title, `%${keyword}%`))
  .orderBy(desc(decks.createdAt))
  .limit(20)
  .offset(page * 20)

// COUNT
const [{ count }] = await db
  .select({ count: sql<number>`count(*)` })
  .from(deckLikes)
  .where(eq(deckLikes.deckId, deckId))
```

### INSERT

```typescript
// 単一行
const [newDeck] = await db.insert(decks).values({
  userId: user.id,
  slug: 'my-presentation',
  title: 'My Presentation',
  fileKey: 'uploads/abc123.pdf',
  originalLanguage: 'ja',
  targetLanguages: ['en', 'zh'],
}).returning()

// 複数行
await db.insert(slides).values(
  pages.map((page, i) => ({
    deckId: newDeck.id,
    pageNumber: i + 1,
    imageKey: page.imageKey,
    originalText: page.text,
  }))
)
```

### UPDATE

```typescript
await db.update(decks)
  .set({ processingStatus: 'ready', slideCount: pageCount })
  .where(eq(decks.id, deckId))
```

### DELETE

```typescript
await db.delete(decks).where(eq(decks.id, deckId))
```

---

## OCC リトライパターン (Aurora DSQL 必須)

```typescript
import { sql } from 'drizzle-orm'

/**
 * Aurora DSQL の楽観的同時実行制御 (OCC) リトライラッパー
 * シリアライゼーションエラー (40001) 発生時に自動リトライ
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const isSerializationError = error?.code === '40001'
      if (isSerializationError && attempt < maxRetries - 1) {
        // 指数バックオフ + ジッター
        const delay = Math.random() * Math.pow(2, attempt) * 100
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}

// 使用例
const result = await withRetry(async () => {
  return await db.insert(deckViews).values({
    deckId,
    viewerId: userId,
  }).returning()
})
```

---

## トランザクション

```typescript
// Aurora DSQL: DDL と DML は別トランザクション
// 1トランザクションで変更可能な行数: 最大 3,000 行
await db.transaction(async (tx) => {
  const [deck] = await tx.insert(decks).values({
    userId: user.id,
    slug,
    title,
    fileKey,
  }).returning()

  await tx.insert(deckEvents).values({
    deckId: deck.id,
    eventType: 'draft',
    version: 1,
    actorId: user.id,
  })

  return deck
})
```

---

## マイグレーション

### drizzle-kit push (開発用、推奨)

```bash
# スキーマの変更を直接 DB に反映 (マイグレーションファイル不要)
npx drizzle-kit push
```

### drizzle-kit generate + migrate (本番用)

```bash
# マイグレーションファイル生成
npx drizzle-kit generate

# マイグレーション実行
npx drizzle-kit migrate
```

---

## Aurora DSQL 固有の注意点

| 制約 | Drizzle での対応 |
|------|-----------------|
| 外部キーなし | `.references()` を使わない。アプリ層で検証 |
| CREATE INDEX ASYNC | `drizzle-kit push` は通常の CREATE INDEX を発行するため、大量データ時は手動で ASYNC 指定 |
| 1トランザクション最大 3,000 行 | バッチ INSERT は 3,000 行以下に分割 |
| OCC (楽観的同時実行制御) | `withRetry()` ラッパーで全 DB 操作を囲む |
| DDL と DML は別トランザクション | スキーマ変更とデータ操作を同一トランザクションに入れない |
| TRUNCATE 非対応 | `db.delete(table)` (WHERE なし) を使用 |
| 一時テーブル非対応 | CTE (`sql` テンプレート) またはサブクエリで代替 |

---

## Server Actions での使用パターン

```typescript
// app/actions/deck.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { getDb } from '@/lib/db'
import { decks, users } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { withRetry } from '@/lib/retry'
import { revalidateTag } from 'next/cache'

export async function createDeck(formData: FormData) {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const db = await getDb()

  // clerk_id からユーザー取得
  const [user] = await db.select().from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (!user) throw new Error('User not found')

  const title = formData.get('title') as string
  const slug = formData.get('slug') as string

  const [deck] = await withRetry(() =>
    db.insert(decks).values({
      userId: user.id,
      slug,
      title,
      fileKey: '', // アップロード後に更新
      originalLanguage: 'ja',
      targetLanguages: ['en'],
    }).returning()
  )

  revalidateTag('decks')
  return deck
}
```

---

## 参考ドキュメントリンク

| トピック | URL |
|----------|-----|
| Get Started (PostgreSQL) | https://orm.drizzle.team/docs/get-started/postgresql-new |
| PostgreSQL カラム型 | https://orm.drizzle.team/docs/column-types/pg |
| スキーマ定義 | https://orm.drizzle.team/docs/sql-schema-declaration |
| SELECT | https://orm.drizzle.team/docs/select |
| INSERT | https://orm.drizzle.team/docs/insert |
| UPDATE | https://orm.drizzle.team/docs/update |
| DELETE | https://orm.drizzle.team/docs/delete |
| フィルター (eq, ilike 等) | https://orm.drizzle.team/docs/operators |
| トランザクション | https://orm.drizzle.team/docs/transactions |
| drizzle-kit (マイグレーション) | https://orm.drizzle.team/docs/kit-overview |
| Zod バリデーション連携 | https://orm.drizzle.team/docs/zod |
