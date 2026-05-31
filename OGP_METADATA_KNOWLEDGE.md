# Next.js Metadata API (OGP) ナレッジまとめ (H0 ハッカソン向け)

> ソース: https://nextjs.org/docs/app/api-reference/functions/generate-metadata

---

## 概要

Next.js App Router の Metadata API で OGP タグを SSR 生成する。`metadata` オブジェクト (静的) または `generateMetadata` 関数 (動的) を export する。

### Hiravi での利用方針
- デッキページ (`/@username/slug`) で動的 OGP を生成
- `og:image` にスライド1枚目の画像 URL (永続的 S3 URL)
- Twitter Card: `summary_large_image`
- SNS シェア時にリッチプレビューを表示

---

## 静的メタデータ

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Hiravi',
    template: '%s | Hiravi',  // 子ページのタイトルに自動付与
  },
  description: 'Share slides globally, translated instantly',
  metadataBase: new URL('https://hiravi.vercel.app'),
}
```

---

## 動的メタデータ (generateMetadata)

```tsx
// app/@[username]/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ username: string; slug: string }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { username, slug } = await params
  const deck = await getDeck(username, slug)

  return {
    title: deck.title,
    description: deck.description || `Slides by @${username}`,
    openGraph: {
      title: deck.title,
      description: deck.description,
      url: `/@${username}/${slug}`,
      siteName: 'Hiravi',
      type: 'article',
      publishedTime: deck.published_at,
      authors: [deck.author_name],
      images: [
        {
          url: `https://hiravi-slides-xxx.s3.amazonaws.com/slides/public/${deck.id}/v${deck.version}/page-1.webp`,
          width: 1280,
          height: 720,
          alt: deck.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: deck.title,
      description: deck.description,
      images: [`https://hiravi-slides-xxx.s3.amazonaws.com/slides/public/${deck.id}/v${deck.version}/page-1.webp`],
    },
  }
}
```

---

## metadataBase

ルートレイアウトで設定すると、相対パスが自動的に絶対 URL に変換される:

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://hiravi.vercel.app'),
  openGraph: {
    images: '/og-default.png',  // → https://hiravi.vercel.app/og-default.png
  },
}
```

---

## OpenGraph フィールド

```tsx
openGraph: {
  title: 'Page Title',
  description: 'Description',
  url: 'https://hiravi.vercel.app/path',
  siteName: 'Hiravi',
  type: 'article',  // 'website' | 'article' | 'profile'
  publishedTime: '2026-06-01T00:00:00.000Z',
  authors: ['Author Name'],
  images: [
    {
      url: 'https://absolute-url.com/image.png',  // 絶対 URL 必須
      width: 1200,
      height: 630,
      alt: 'Alt text',
    },
  ],
}
```

### 出力される HTML

```html
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Description" />
<meta property="og:url" content="https://hiravi.vercel.app/path" />
<meta property="og:site_name" content="Hiravi" />
<meta property="og:type" content="article" />
<meta property="og:image" content="https://..." />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Alt text" />
```

---

## Twitter Card

```tsx
twitter: {
  card: 'summary_large_image',
  title: 'Title',
  description: 'Description',
  creator: '@hiravi_app',
  images: ['https://absolute-url.com/image.png'],
}
```

### 出力される HTML

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Title" />
<meta name="twitter:description" content="Description" />
<meta name="twitter:creator" content="@hiravi_app" />
<meta name="twitter:image" content="https://..." />
```

---

## title テンプレート

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    default: 'Hiravi',
    template: '%s | Hiravi',
  },
}

// app/browse/page.tsx
export const metadata: Metadata = {
  title: 'Browse Slides',  // → "Browse Slides | Hiravi"
}
```

### absolute (テンプレート無視)

```tsx
export const metadata: Metadata = {
  title: {
    absolute: 'Custom Title',  // テンプレートを無視
  },
}
```

---

## メタデータのマージ規則

- 子セグメントの metadata は親を**浅くマージ**する
- 同じキーは子が上書き
- `openGraph` を子で定義すると、親の `openGraph` は**全て上書き**される
- 子で `openGraph` を定義しなければ、親の値が**継承**される

### 共有パターン

```tsx
// app/shared-metadata.ts
export const openGraphImage = {
  images: ['https://hiravi.vercel.app/og-default.png'],
}

// app/page.tsx
import { openGraphImage } from './shared-metadata'
export const metadata = {
  openGraph: { ...openGraphImage, title: 'Home' },
}
```

---

## Hiravi OGP キャッシュバスティング戦略

### 問題
SNS クローラーは OGP 画像をキャッシュする (X: ~7日、Facebook: ~24時間)。デッキ更新時に古い画像が表示され続ける。

### 解決策
画像 URL にバージョン番号を含める:

```
slides/public/{deck_id}/v1/page-1.webp  ← 初回
slides/public/{deck_id}/v2/page-1.webp  ← 更新後
```

URL が変わるため、SNS は新しい URL を新コンテンツとして再取得する。

### 補助策
- `og:updated_time` を付与 (Facebook のキャッシュ更新ヒント)
- Facebook Sharing Debugger で手動キャッシュクリア可能

---

## robots メタデータ

```tsx
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
}
```

---

## 注意事項

- `generateMetadata` は Server Component でのみ使用可能
- `metadata` オブジェクトと `generateMetadata` は同じセグメントで併用不可
- `generateMetadata` 内の `fetch` は自動メモ化される
- `og:image` は**絶対 URL** が必須 (相対パスは `metadataBase` で補完)
- presigned URL を `og:image` に使わない (期限切れでクローラーが取得失敗)
- v15.2.0 以降: メタデータのストリーミング対応 (HTML-limited bots には従来通りブロッキング)
