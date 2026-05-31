# Vercel デプロイ & ISR/キャッシュ ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://nextjs.org/docs/app/guides/incremental-static-regeneration
> - https://nextjs.org/docs/app/api-reference/functions/revalidateTag
> - https://nextjs.org/docs/app/api-reference/functions/revalidatePath
> - https://nextjs.org/docs/app/getting-started/images

---

## ISR (Incremental Static Regeneration)

静的ページを再ビルドなしで更新する仕組み。Hiravi ではデッキページを ISR でキャッシュし、Lambda 処理完了時に on-demand revalidation で即時更新する。

---

## 時間ベース Revalidation

```tsx
// app/browse/page.tsx
export const revalidate = 3600 // 1時間ごとに再生成

export default async function BrowsePage() {
  const decks = await fetchPublicDecks()
  return <DeckGrid decks={decks} />
}
```

動作:
1. ビルド時にページ生成
2. 1時間経過後、次のリクエストでキャッシュ (stale) を返しつつバックグラウンドで再生成
3. 再生成完了後、以降のリクエストに新しいページを返す

---

## On-Demand Revalidation (revalidateTag)

### タグ付きデータフェッチ

```tsx
// app/@[username]/[slug]/page.tsx
const deck = await fetch(`${API_URL}/decks/${slug}`, {
  next: { tags: [`deck-${deckId}`] }
})
```

### unstable_cache でタグ付け (DB クエリ用)

```tsx
import { unstable_cache } from 'next/cache'

const getCachedDeck = unstable_cache(
  async (deckId: string) => {
    return await db.select().from(decks).where(eq(decks.id, deckId))
  },
  ['deck'],
  { revalidate: 3600, tags: [`deck-${deckId}`] }
)
```

### Server Action / Route Handler で無効化

```tsx
'use server'
import { revalidateTag } from 'next/cache'

export async function onProcessingComplete(deckId: string) {
  revalidateTag(`deck-${deckId}`)
}
```

---

## Hiravi の Revalidation 戦略

### Lambda → Vercel Webhook フロー

```
Lambda 処理完了
  → POST /api/revalidate { deck_id, secret }
  → Route Handler で X-Webhook-Secret 検証
  → revalidateTag(`deck-${deck_id}`)
  → 次のリクエストで最新データが返る
```

### Webhook Route Handler 実装

```tsx
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { deck_id } = await request.json()
  revalidateTag(`deck-${deck_id}`)
  return NextResponse.json({ revalidated: true })
}
```

---

## revalidatePath

パス全体のキャッシュを無効化:

```tsx
import { revalidatePath } from 'next/cache'

// 特定デッキページ
revalidatePath('/@username/my-deck')

// ブラウズページ全体
revalidatePath('/browse')
```

---

## Next.js Image Optimization

### 基本使用

```tsx
import Image from 'next/image'

<Image
  src={`https://hiravi-slides-xxx.s3.amazonaws.com/slides/public/${deckId}/v1/page-1.webp`}
  alt="Slide 1"
  width={1280}
  height={720}
  priority  // LCP 画像に付与
/>
```

### next.config.js 設定

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        pathname: '/slides/**',
      },
    ],
  },
}
```

### 特徴
- 自動 WebP/AVIF 変換
- デバイス幅に応じたリサイズ (srcset 自動生成)
- Lazy loading (デフォルト)
- Vercel Edge でキャッシュ (実装コストゼロ)

---

## Vercel 環境変数

### 設定方法
Vercel Dashboard → Project → Settings → Environment Variables

### 種類
- **Production**: 本番のみ
- **Preview**: プレビューデプロイのみ
- **Development**: `vercel dev` 時のみ

### Hiravi で必要な環境変数

```env
# AWS
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-northeast-1

# Aurora DSQL
DSQL_ENDPOINT=xxx.dsql.us-east-1.on.aws
DATABASE_URL=postgresql://...

# S3
S3_BUCKET_NAME=hiravi-slides-xxx
S3_REGION=ap-northeast-1

# SQS
SQS_QUEUE_URL=https://sqs.ap-northeast-1.amazonaws.com/xxx/hiravi-processing-queue

# Clerk
CLERK_SECRET_KEY=sk_xxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx

# Upstash
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Webhook
WEBHOOK_SECRET=xxx

# App
NEXT_PUBLIC_APP_URL=https://hiravi.vercel.app
```

### セキュリティ注意
- `NEXT_PUBLIC_` プレフィックスはクライアントに露出する
- AWS キー、WEBHOOK_SECRET 等は絶対に `NEXT_PUBLIC_` を付けない
- `server-only` パッケージで Server Component 専用モジュールを保護

---

## Vercel デプロイ設定

### vercel.json (オプション)

```json
{
  "framework": "nextjs",
  "regions": ["hnd1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

### ISR キャッシュヘッダー確認

レスポンスヘッダー `x-nextjs-cache`:
- `HIT` — キャッシュから配信
- `STALE` — キャッシュ配信 + バックグラウンド再生成中
- `MISS` — キャッシュなし、新規レンダリング

---

## 注意事項

- ISR は Node.js ランタイムのみ対応 (Edge Runtime 非対応)
- `revalidate: 0` または `no-store` を使うとページは動的レンダリングになる
- 複数の fetch で異なる revalidate 値がある場合、最小値が採用される
- Vercel では ISR キャッシュは自動的にグローバル CDN に配信される
