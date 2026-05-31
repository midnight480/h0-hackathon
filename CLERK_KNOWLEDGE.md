# Clerk ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://clerk.com/docs
> - https://clerk.com/docs/nextjs/getting-started/quickstart
> - https://clerk.com/docs/reference/nextjs/clerk-middleware
> - https://clerk.com/docs/nextjs/guides/users/reading
> - https://clerk.com/docs/webhooks/sync-data

---

## Clerk とは

Clerk はホスト型の認証・ユーザー管理基盤。プリビルト UI コンポーネント、セッション管理、MFA、Bot 対策をすべてホスト側で担保する。SOC 2 Type II 認証済み。

### 料金
- 無料枠: 10,000 MAU (ハッカソンに十分)
- 使用量ベース課金 (アクティブユーザー単位)

### Hiravi での利用方針
- Google / GitHub OAuth でサインイン
- Aurora DSQL には `clerk_id` (Clerk の user_id) のみ保存
- パスワード等の機密情報は DB に持たない
- Clerk Webhook でプロフィール変更を Aurora DSQL に同期

---

## Next.js (App Router) セットアップ

### 1. インストール

```bash
npm install @clerk/nextjs
```

### 2. 環境変数

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

### 3. Middleware (proxy.ts / middleware.ts)

Next.js 16+ では `proxy.ts`、15以下では `middleware.ts` にファイル名を変更。

```typescript
// proxy.ts (or middleware.ts for Next.js ≤15)
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/upload(.*)',
  '/settings(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
```

**ポイント:**
- `clerkMiddleware()` はデフォルトで全ルートを公開 (opt-in で保護)
- `createRouteMatcher()` で保護対象ルートを定義
- `auth.protect()` で未認証ユーザーをサインインページにリダイレクト

### 4. Layout に ClerkProvider を追加

```typescript
// app/layout.tsx
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <header>
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
```

---

## サーバーサイドでのユーザーデータ取得

### Server Components / Server Actions

```typescript
import { auth, currentUser } from '@clerk/nextjs/server'

export default async function Page() {
  // 認証状態の確認
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    return <div>Sign in to view this page</div>
  }

  // Backend User オブジェクト取得 (名前、メール等)
  const user = await currentUser()

  return <div>Welcome, {user.firstName}!</div>
}
```

### Route Handlers

```typescript
// app/api/example/route.ts
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    return new Response('Unauthorized', { status: 401 })
  }

  // userId を使って DB クエリ等
  return Response.json({ userId })
}
```

---

## クライアントサイドでのユーザーデータ取得

### useAuth() — 認証状態

```typescript
'use client'
import { useAuth } from '@clerk/nextjs'

export default function Example() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()

  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <div>Sign in to view this page</div>

  return <div>Hello, {userId}!</div>
}
```

### useUser() — ユーザー情報

```typescript
'use client'
import { useUser } from '@clerk/nextjs'

export default function Page() {
  const { isSignedIn, user, isLoaded } = useUser()

  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <div>Sign in to view this page</div>

  return <div>Hello {user.firstName}!</div>
}
```

---

## プリビルト UI コンポーネント

| コンポーネント | 用途 |
|---|---|
| `<SignIn />` | サインインフォーム (フルページ) |
| `<SignUp />` | サインアップフォーム (フルページ) |
| `<UserButton />` | アバター + ドロップダウンメニュー (プロフィール管理) |
| `<SignInButton />` | サインインページへのリンクボタン |
| `<SignUpButton />` | サインアップページへのリンクボタン |
| `<Show when="signed-in">` | サインイン時のみ表示 |
| `<Show when="signed-out">` | サインアウト時のみ表示 |
| `<UserProfile />` | プロフィール編集ページ |

---

## Webhook によるデータ同期

### ユースケース
- ユーザー作成時に Aurora DSQL の `users` テーブルに INSERT
- プロフィール更新時に `users` テーブルを UPDATE (Clerk が正)
- ユーザー削除時に `users` テーブルから DELETE (or soft delete)

### イベント一覧 (主要)

| イベント | トリガー |
|---|---|
| `user.created` | 新規ユーザー登録 |
| `user.updated` | プロフィール変更 (名前、アバター等) |
| `user.deleted` | アカウント削除 |

### Webhook ハンドラー実装

```typescript
// app/api/webhooks/route.ts
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    const { id } = evt.data
    const eventType = evt.type

    if (evt.type === 'user.created') {
      // Aurora DSQL に INSERT
      // evt.data.id → clerk_id
      // evt.data.email_addresses[0].email_address → email
      // evt.data.first_name, evt.data.last_name → name
      // evt.data.image_url → avatar_url
    }

    if (evt.type === 'user.updated') {
      // Aurora DSQL を UPDATE (clerk_id で検索)
    }

    if (evt.type === 'user.deleted') {
      // Aurora DSQL から DELETE (or soft delete)
    }

    return new Response('Webhook received', { status: 200 })
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error verifying webhook', { status: 400 })
  }
}
```

### 重要な注意点
- Webhook ルートは **公開** にする必要がある (認証情報が含まれないため)
- `clerkMiddleware()` で `/api/webhooks(.*)` を保護対象から除外すること
- Webhook は **結果整合性** — 配信失敗時のリトライあり
- 署名検証に `CLERK_WEBHOOK_SIGNING_SECRET` を使用 (Svix ベース)
- 4xx/5xx を返すとリトライされる、2xx で成功

### ローカル開発でのテスト
1. ngrok でローカルサーバーを公開: `ngrok http --url=<YOUR_URL> 3000`
2. Clerk Dashboard → Webhooks → Add Endpoint → ngrok URL + `/api/webhooks`
3. イベント選択 (`user.created` 等)
4. Testing タブから Send Example でテスト

### 本番設定
1. Clerk Dashboard → Webhooks → Add Endpoint → 本番 URL + `/api/webhooks`
2. Signing Secret を本番環境変数に設定
3. 再デプロイ

---

## Hiravi での認証フロー

```
┌─────────────────────────────────────────────────────────┐
│                    ユーザーのブラウザ                       │
│                                                         │
│  1. <SignUpButton /> クリック                             │
│  2. Clerk Account Portal でサインアップ (Google/GitHub)    │
│  3. セッション確立 → リダイレクト                          │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Vercel (Next.js)                         │
│                                                         │
│  clerkMiddleware() でセッション検証                        │
│  auth() / currentUser() でユーザー情報取得                 │
│  Server Actions で clerk_id を使って DB 操作               │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    Clerk     │  │ Aurora DSQL  │  │  Clerk       │
│  (認証基盤)   │  │ (users テーブル│  │  Webhook     │
│  セッション管理│  │  clerk_id で  │  │  → DB 同期   │
│  OAuth       │  │  参照)        │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## username の設定 (Hiravi 固有)

Hiravi では URL に `/@{username}/{slug}` を使用するため、サインアップ後に username を設定する必要がある。

### 実装方針
1. サインアップ完了後、オンボーディングページ (`/onboarding`) にリダイレクト
2. username を入力 (英数字 + ハイフン、3〜30文字、一意)
3. Aurora DSQL の `users` テーブルに username を保存
4. 以降のアクセスで username 未設定なら `/onboarding` にリダイレクト

```typescript
// middleware で username 未設定チェック
export default clerkMiddleware(async (auth, req) => {
  const { isAuthenticated, userId } = await auth()

  if (isAuthenticated && !req.nextUrl.pathname.startsWith('/onboarding')) {
    // DB で username が設定済みか確認
    // 未設定なら /onboarding にリダイレクト
  }
})
```

---

## 環境変数まとめ (Hiravi)

```env
# Clerk (必須)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Webhook
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Clerk リダイレクト設定 (オプション)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

---

## セキュリティ上の注意

- `CLERK_SECRET_KEY` は絶対にクライアントに露出させない (`NEXT_PUBLIC_` プレフィックスなし)
- Webhook の署名検証は必ず行う (Svix ライブラリ or `verifyWebhook()`)
- Server Actions / Route Handlers では必ず `auth()` で認証チェック
- `currentUser()` は Backend API リクエストを発生させるため、レート制限に注意
- クライアントサイドでは `useUser()` を優先使用

---

## 参考ドキュメントリンク

| トピック | URL |
|----------|-----|
| Next.js Quickstart | https://clerk.com/docs/nextjs/getting-started/quickstart |
| clerkMiddleware() | https://clerk.com/docs/reference/nextjs/clerk-middleware |
| auth() / currentUser() | https://clerk.com/docs/nextjs/guides/users/reading |
| Webhook でデータ同期 | https://clerk.com/docs/webhooks/sync-data |
| UI コンポーネント一覧 | https://clerk.com/docs/reference/components/overview |
| 環境変数 | https://clerk.com/docs/guides/development/clerk-environment-variables |
| セッショントークン | https://clerk.com/docs/guides/sessions/session-tokens |
