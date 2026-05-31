# Upstash Redis ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://upstash.com/docs/redis/tutorials/nextjs_with_redis
> - https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted
> - https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
> - https://upstash.com/docs/redis/sdks/ratelimit-ts/methods

---

## Upstash Redis とは

サーバーレス Redis。REST API ベースで Edge Functions / Vercel Serverless から接続可能。従量課金 + 無料枠あり。

### Hiravi での利用方針
1. **Rate Limit** — API エンドポイントの乱用防止 (IP + ユーザー単位)
2. **HyperLogLog** — 閲覧数・いいね数の近似集計 (誤差率 0.81%)
3. **キャッシュ** — 頻繁にアクセスされるデッキメタデータの一時キャッシュ (オプション)

---

## セットアップ

### インストール

```bash
npm install @upstash/redis @upstash/ratelimit
```

### 環境変数

```env
UPSTASH_REDIS_REST_URL=https://****.upstash.io
UPSTASH_REDIS_REST_TOKEN=********
```

Vercel + Upstash Integration を使う場合:
```env
KV_REST_API_URL=https://****.upstash.io
KV_REST_API_TOKEN=********
```

### Redis クライアント初期化

```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis'

export const redis = Redis.fromEnv()

// または明示的に指定
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
```

---

## Rate Limiting

### 基本セットアップ

```typescript
// lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// API 全般: 1分あたり 60 リクエスト
export const apiRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
  prefix: '@hiravi/api',
})

// アップロード: 1時間あたり 10 回
export const uploadRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
  prefix: '@hiravi/upload',
})

// 翻訳: 1日あたり 50 回 (ユーザー単位)
export const translateRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(50, '1 d'),
  analytics: true,
  prefix: '@hiravi/translate',
})

// いいね: 1分あたり 30 回 (スパム防止)
export const likeRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: true,
  prefix: '@hiravi/like',
})
```

### Server Action での使用

```typescript
// app/actions/upload.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { uploadRatelimit } from '@/lib/ratelimit'
import { headers } from 'next/headers'

export async function uploadDeck(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // Rate limit チェック (ユーザー ID で識別)
  const { success, limit, remaining, reset } = await uploadRatelimit.limit(userId)

  if (!success) {
    throw new Error(
      `Rate limit exceeded. Try again after ${new Date(reset).toISOString()}`
    )
  }

  // アップロード処理...
}
```

### API Route での使用

```typescript
// app/api/decks/[id]/like/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { likeRatelimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  // IP アドレスで識別 (未ログインユーザー対応)
  const ip = req.headers.get('x-forwarded-for') ?? req.ip ?? '127.0.0.1'
  const { success } = await likeRatelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  // いいね処理...
}
```

### Middleware での使用 (全 API ルート保護)

```typescript
// middleware.ts (Clerk middleware と組み合わせ)
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: '@hiravi/global',
})

export async function ratelimitMiddleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success } = await ratelimit.limit(ip)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }
  }
}
```

---

## アルゴリズム比較

| アルゴリズム | 関数 | 特徴 | 用途 |
|---|---|---|---|
| Fixed Window | `Ratelimit.fixedWindow(10, "10 s")` | シンプル、低コスト。境界でバースト可能 | 日次制限 (翻訳回数) |
| Sliding Window | `Ratelimit.slidingWindow(10, "10 s")` | 境界問題を解決。近似値 | API 全般 (推奨) |
| Token Bucket | `Ratelimit.tokenBucket(5, "10 s", 10)` | バーストを平滑化。初期バースト許容 | アップロード |

### 時間単位の指定

```
"1 ms"   — 1ミリ秒
"1 s"    — 1秒
"1 m"    — 1分
"1 h"    — 1時間
"1 d"    — 1日
```

---

## HyperLogLog (閲覧数・いいね数の近似集計)

```typescript
// lib/analytics.ts
import { redis } from './redis'

/**
 * デッキの閲覧をカウント (ユニークユーザー)
 * HyperLogLog: 誤差率 0.81%、数百万件でも定数時間・定数メモリ
 */
export async function trackView(deckId: string, viewerId: string) {
  // PFADD: ユニーク要素を追加 (重複は自動無視)
  await redis.pfadd(`views:${deckId}`, viewerId)
}

/**
 * デッキのユニーク閲覧数を取得
 */
export async function getViewCount(deckId: string): Promise<number> {
  // PFCOUNT: ユニーク要素数の近似値を返す
  return await redis.pfcount(`views:${deckId}`)
}

/**
 * デッキのいいね数をインクリメント
 * (正確なカウントが必要な場合は INCR を使用)
 */
export async function incrementLikeCount(deckId: string): Promise<number> {
  return await redis.incr(`likes:${deckId}`)
}

/**
 * デッキのいいね数を取得
 */
export async function getLikeCount(deckId: string): Promise<number> {
  return (await redis.get<number>(`likes:${deckId}`)) ?? 0
}

/**
 * 複数デッキのいいね数を一括取得 (一覧表示用)
 */
export async function getLikeCounts(deckIds: string[]): Promise<Record<string, number>> {
  const pipeline = redis.pipeline()
  for (const id of deckIds) {
    pipeline.get(`likes:${id}`)
  }
  const results = await pipeline.exec<(number | null)[]>()

  const counts: Record<string, number> = {}
  deckIds.forEach((id, i) => {
    counts[id] = results[i] ?? 0
  })
  return counts
}
```

---

## キャッシュパターン (オプション)

```typescript
// lib/cache.ts
import { redis } from './redis'

const CACHE_TTL = 60 * 5 // 5分

/**
 * デッキメタデータのキャッシュ
 */
export async function getCachedDeck(deckId: string) {
  const cached = await redis.get<DeckMetadata>(`deck:${deckId}`)
  if (cached) return cached

  // キャッシュミス → DB から取得
  const deck = await fetchDeckFromDb(deckId)
  if (deck) {
    await redis.set(`deck:${deckId}`, deck, { ex: CACHE_TTL })
  }
  return deck
}

/**
 * キャッシュ無効化 (デッキ更新時)
 */
export async function invalidateDeckCache(deckId: string) {
  await redis.del(`deck:${deckId}`)
}
```

---

## Vercel サーバーレス環境での注意点

```typescript
// サーバーレス環境では pending を待つ必要がある
const { success, pending } = await ratelimit.limit(identifier)

// Vercel の waitUntil で非同期処理を完了させる
// (analytics の送信等がバックグラウンドで行われるため)
import { waitUntil } from '@vercel/functions'
waitUntil(pending)
```

---

## 料金 (Upstash Redis)

| プラン | 内容 |
|--------|------|
| Free | 10,000 コマンド/日、256MB |
| Pay As You Go | $0.2 / 100K コマンド |

ハッカソン規模 (30ユーザー) なら無料枠で十分。

---

## 環境変数まとめ (Hiravi)

```env
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...

# Vercel Integration 経由の場合
KV_REST_API_URL=https://your-instance.upstash.io
KV_REST_API_TOKEN=AX...
```

---

## 参考ドキュメントリンク

| トピック | URL |
|----------|-----|
| Next.js + Redis チュートリアル | https://upstash.com/docs/redis/tutorials/nextjs_with_redis |
| Ratelimit Getting Started | https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted |
| Ratelimit アルゴリズム | https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms |
| Ratelimit メソッド | https://upstash.com/docs/redis/sdks/ratelimit-ts/methods |
| Redis コマンド (PFADD 等) | https://upstash.com/docs/redis/overall/rediscompatibility |
| Vercel Integration | https://upstash.com/docs/redis/howto/vercelintegration |
