# Next.js ナレッジまとめ (H0 ハッカソン向け)

> ソース: https://nextjs.org/docs (v16.2.6, 2026年5月時点)

---

## 概要

Next.js は React ベースのフルスタック Web フレームワーク。v0 が生成するコードのベースとなる。

- **最新バージョン**: 16.2.6
- **ルーター**: App Router (推奨) / Pages Router (レガシー)
- **React バージョン**: App Router は React canary (19+) を内蔵

---

## プロジェクト構造 (App Router)

```
app/
├── layout.tsx          # ルートレイアウト (必須)
├── page.tsx            # ルートページ
├── loading.tsx         # ローディング UI
├── error.tsx           # エラー UI
├── not-found.tsx       # 404 UI
├── (group)/            # Route Group (URLに影響しない)
├── [slug]/             # Dynamic Segment
│   └── page.tsx
├── api/
│   └── route.ts        # Route Handler (API エンドポイント)
└── globals.css
lib/
├── db.ts               # DB接続
└── utils.ts
public/                 # 静的ファイル
next.config.js          # 設定ファイル
```

---

## Server Components vs Client Components

### デフォルト: Server Components
- `app/` 内のすべてのコンポーネントはデフォルトで Server Component
- サーバーでレンダリング → HTML をクライアントに送信
- DB クエリ、API キー使用、重い処理に最適

### Client Components (`'use client'`)
- ファイル先頭に `'use client'` ディレクティブを追加
- インタラクティブ機能が必要な場合に使用

| Server Components を使う場面 | Client Components を使う場面 |
|---|---|
| DB/API からデータ取得 | state / event handler (onClick等) |
| API キー・シークレット使用 | useEffect 等のライフサイクル |
| JS バンドルサイズ削減 | ブラウザ API (localStorage等) |
| SEO / FCP 改善 | カスタムフック |

### コード例

```tsx
// app/[id]/page.tsx - Server Component (デフォルト)
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({ params }) {
  const { id } = await params
  const post = await getPost(id)
  return (
    <div>
      <h1>{post.title}</h1>
      <LikeButton likes={post.likes} />
    </div>
  )
}
```

```tsx
// app/ui/like-button.tsx - Client Component
'use client'
import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  const [count, setCount] = useState(likes)
  return <button onClick={() => setCount(count + 1)}>{count} likes</button>
}
```

### 重要なパターン: Interleaving
- Server Component を Client Component の `children` として渡せる
- Context Provider は Client Component として作成し、layout で wrap

```tsx
// app/theme-provider.tsx
'use client'
import { createContext } from 'react'
export const ThemeContext = createContext({})
export default function ThemeProvider({ children }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}

// app/layout.tsx
import ThemeProvider from './theme-provider'
export default function RootLayout({ children }) {
  return (
    <html><body>
      <ThemeProvider>{children}</ThemeProvider>
    </body></html>
  )
}
```

---

## データ取得 (Fetching Data)

### Server Components でのデータ取得

#### fetch API
```tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/posts')
  const posts = await data.json()
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

#### ORM / Database (H0 ハッカソンで重要)
```tsx
import { db, posts } from '@/lib/db'

export default async function Page() {
  const allPosts = await db.select().from(posts)
  return <ul>{allPosts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

- Server Components ではクレデンシャルがクライアントバンドルに含まれない
- ORM (Drizzle, Prisma) を安全に使用可能

### 並列データ取得 (Promise.all)
```tsx
export default async function Page({ params }) {
  const { username } = await params
  // 並列で開始
  const artistData = getArtist(username)
  const albumsData = getAlbums(username)
  // 同時に await
  const [artist, albums] = await Promise.all([artistData, albumsData])
  return <>{artist.name}</>
}
```

### ストリーミング

#### loading.tsx (ルートセグメント全体)
```tsx
// app/blog/loading.tsx
export default function Loading() {
  return <div>Loading...</div>
}
```

#### Suspense (細粒度)
```tsx
import { Suspense } from 'react'
import BlogList from '@/components/BlogList'

export default function BlogPage() {
  return (
    <div>
      <header><h1>Blog</h1></header>
      <Suspense fallback={<div>Loading posts...</div>}>
        <BlogList />
      </Suspense>
    </div>
  )
}
```

### Client Components でのデータ取得

#### use API (Server → Client ストリーミング)
```tsx
// Server Component
export default function Page() {
  const posts = getPosts() // await しない
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts posts={posts} />
    </Suspense>
  )
}

// Client Component
'use client'
import { use } from 'react'
export default function Posts({ posts }) {
  const allPosts = use(posts)
  return <ul>{allPosts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

#### SWR / React Query
```tsx
'use client'
import useSWR from 'swr'
const fetcher = (url) => fetch(url).then(r => r.json())

export default function BlogPage() {
  const { data, error, isLoading } = useSWR('/api/posts', fetcher)
  if (isLoading) return <div>Loading...</div>
  return <ul>{data.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

---

## データ変更 (Mutating Data) - Server Actions

```tsx
// app/actions.ts
'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  await db.insert(posts).values({ title })
  revalidatePath('/blog')
}
```

```tsx
// app/blog/new/page.tsx
import { createPost } from '@/app/actions'

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" />
      <button type="submit">Create</button>
    </form>
  )
}
```

---

## Route Handlers (API エンドポイント)

```tsx
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const posts = await db.select().from(postsTable)
  return NextResponse.json(posts)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newPost = await db.insert(postsTable).values(body).returning()
  return NextResponse.json(newPost, { status: 201 })
}
```

---

## 環境変数

```bash
# .env.local (gitignore に含める)
DATABASE_URL=postgresql://user:pass@host:5432/db
API_SECRET=sk_live_xxx

# クライアントサイドで使う場合は NEXT_PUBLIC_ プレフィックス
NEXT_PUBLIC_APP_URL=https://myapp.vercel.app
```

- `process.env.DATABASE_URL` → サーバーサイドのみ
- `process.env.NEXT_PUBLIC_APP_URL` → クライアントでも使用可能
- `NEXT_PUBLIC_` なしの変数はクライアントバンドルに含まれない (安全)

---

## キャッシュと再検証

### use cache ディレクティブ (Next.js 16+)
```tsx
'use cache'

export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  return <div>{/* ... */}</div>
}
```

### revalidatePath / revalidateTag
```tsx
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'

// パスベースの再検証
revalidatePath('/blog')

// タグベースの再検証
revalidateTag('posts')
```

---

## H0 ハッカソンで特に重要な機能

### 1. Server Actions + DB 操作
- フォーム送信 → Server Action → DB 書き込み → revalidate
- v0 で生成する際に「Server Actions を使って」と指示

### 2. Streaming + Suspense
- 重い DB クエリを Suspense で wrap → UX 向上
- 審査基準の「Design」で評価される

### 3. Route Handlers
- 外部 API 連携、Webhook 受信に使用
- DynamoDB 操作の API エンドポイントとして

### 4. Middleware
```tsx
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 認証チェック、リダイレクト等
  return NextResponse.next()
}

export const config = {
  matcher: '/dashboard/:path*',
}
```

### 5. Metadata & SEO
```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
  description: 'Built with Next.js and AWS',
}
```

---

## ドキュメント構成 (参照用リンク)

| セクション | URL |
|-----------|-----|
| Getting Started | https://nextjs.org/docs/app/getting-started |
| Server/Client Components | https://nextjs.org/docs/app/getting-started/server-and-client-components |
| Fetching Data | https://nextjs.org/docs/app/getting-started/fetching-data |
| Mutating Data | https://nextjs.org/docs/app/getting-started/mutating-data |
| Caching | https://nextjs.org/docs/app/getting-started/caching |
| Route Handlers | https://nextjs.org/docs/app/getting-started/route-handlers |
| Authentication | https://nextjs.org/docs/app/guides/authentication |
| Environment Variables | https://nextjs.org/docs/app/guides/environment-variables |
| Forms | https://nextjs.org/docs/app/guides/forms |
| Streaming | https://nextjs.org/docs/app/guides/streaming |
| Deploying | https://nextjs.org/docs/app/getting-started/deploying |
| LLM 向けドキュメント | https://nextjs.org/docs/llms.txt |

---

## セキュリティのベストプラクティス

1. **server-only パッケージ**: DB 接続コードに `import 'server-only'` を追加
2. **環境変数**: シークレットに `NEXT_PUBLIC_` を付けない
3. **入力バリデーション**: Server Actions で zod 等を使用
4. **認証**: middleware で保護ルートをガード
5. **CORS**: Route Handlers で適切に設定
