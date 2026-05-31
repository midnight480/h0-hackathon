# shadcn/ui ナレッジまとめ (H0 ハッカソン向け)

> ソース: https://ui.shadcn.com/docs

---

## shadcn/ui とは

Radix UI + Tailwind CSS ベースのコンポーネントライブラリ。npm パッケージではなく、コンポーネントのソースコードを直接プロジェクトにコピーする方式。カスタマイズ性が高い。

### Hiravi での利用方針
- v0 が生成するコードの UI 基盤
- ダーク/ライトモード対応
- Card, Button, Dialog, Tabs, Select, Badge, Skeleton 等を多用

---

## Next.js セットアップ

### CLI で初期化

```bash
pnpm dlx shadcn@latest init -t next
```

### 既存プロジェクトに追加

```bash
pnpm dlx shadcn@latest init
```

前提: Tailwind CSS + `@/*` import alias が設定済み。

### コンポーネント追加

```bash
pnpm dlx shadcn@latest add button card dialog tabs select badge skeleton
```

### インポート

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
```

---

## Hiravi で使うコンポーネント一覧

| コンポーネント | 用途 |
|---|---|
| Button | アクション (アップロード、いいね、シェア) |
| Card | デッキカード (サムネイル + タイトル + メタ) |
| Dialog | 確認ダイアログ (削除、公開) |
| Tabs | カテゴリ切り替え、翻訳表示モード切り替え |
| Select | 言語選択ドロップダウン |
| Badge | ステータス表示 (processing/ready/failed) |
| Skeleton | ローディング状態 |
| Input / Textarea | フォーム入力 |
| Checkbox | 翻訳先言語の複数選択 |
| Dropdown Menu | ユーザーメニュー、ソート切り替え |
| Sonner (Toast) | 通知 (処理完了、エラー) |
| Progress | アップロード進捗 |
| Avatar | ユーザーアイコン |
| Tooltip | ヘルプテキスト |
| Separator | セクション区切り |

---

## テーマ設定

### CSS 変数方式 (推奨)

`globals.css` で CSS 変数を定義し、Tailwind がマッピング:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  /* ... */
}
```

### トークン規約

`background` / `foreground` のペアで管理:
- `primary` + `primary-foreground`
- `secondary` + `secondary-foreground`
- `muted` + `muted-foreground`
- `accent` + `accent-foreground`
- `destructive`
- `border`, `input`, `ring`

### 使い方

```tsx
<div className="bg-primary text-primary-foreground">Hello</div>
<div className="bg-muted text-muted-foreground">Subtitle</div>
```

---

## ダークモード (Next.js)

### next-themes を使用

```bash
npm install next-themes
```

### ThemeProvider 設定

```tsx
// components/theme-provider.tsx
"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

### layout.tsx に適用

```tsx
// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### テーマ切り替えボタン

```tsx
"use client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  return (
    <Button variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Toggle
    </Button>
  )
}
```

---

## カスタムトークン追加

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

→ `bg-warning text-warning-foreground` で使用可能。

---

## ベースカラー選択肢

Neutral, Stone, Zinc, Mauve, Olive, Mist, Taupe

Hiravi: **Neutral** ベース + Blue アクセント (スライド共有プラットフォームらしい清潔感)
