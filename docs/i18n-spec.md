# Hiravi UI i18n 実装仕様書（JP/EN 最小対応）

> Claude Code Web への移譲用ブリーフ。この1枚で実装着手できるよう自己完結させてある。
> 実装は本仕様に従い、ブランチを切って PR を作成すること。出力（コメント・コミットメッセージ等）は日本語、コード識別子は英語。

## 0. ゴール
Hiravi 自前 UI を **日本語 / 英語** の2言語に対応させる。ヘッダーの言語トグルで切り替え、Cookie で永続化する。
**フル i18n（ロケールルーティング `/[locale]`、hreflang、next-intl）は導入しない。** ハッカソン向けの軽量実装に限定する。

## 1. 最重要の前提：2種類の「言語」を混同しない

| 概念 | 何 | 今回の扱い |
|---|---|---|
| **UI ロケール** | アプリの画面文言（ボタン/ラベル/見出し）の言語。`ja` / `en` | ★今回追加するもの |
| **デッキ閲覧言語** | `deck-viewer.tsx` の `lang: LanguageCode` 状態。スライド本文をどの言語で読むか（75言語） | **既存機能。一切変更しない** |

- `deck-viewer.tsx` の `lang` / `setLang` / `slideText` ロジックには手を入れない。
- UI ロケールはあくまで「ビューワーの枠（"{n} languages" ラベル、aria-label、バッジ等）」にのみ適用する。
- 2つを連動させたり共有 state にしたりしないこと。

## 2. アーキテクチャ決定

- **方式**: 手書き辞書（外部ライブラリ追加なし）。パッケージマネージャは **pnpm**。
- **ロケール保持**: Cookie `hiravi_locale`（値 `ja` / `en`）。
- **ロケール解決の優先順位**: ①Cookie（ユーザーがトグルで明示選択した値） → ②ブラウザ言語（`Accept-Language` ヘッダー。先頭の言語タグが日本語＝`ja`/`ja-JP` 等なら `ja`、それ以外は `en`） → ③デフォルト `en`。
  - 初回アクセス（Cookie 未設定）時はブラウザ言語で自動選択される。日本語ブラウザなら日本語、それ以外は英語。
  - トグル操作で Cookie が書かれると以後そちらが最優先になるため、ブラウザ言語と異なる言語への切り替え（およびその逆）も可能。
  - `Accept-Language` の読み取りはサーバ（`app/layout.tsx` → `getLocaleFromCookie()`）で行う。layout は既に Cookie を読むため動的レンダリングであり、追加コストはない。
- **ルーティング変更なし**: URL に locale を付けない。`middleware` / `proxy.ts` は触らない。
- **Clerk ミドルウェアに干渉しない**こと（共存設定が不要な構成を選んだ理由がこれ）。
- **SSR 一貫性**: サーバ（`app/layout.tsx`）で Cookie を読み、対応する辞書を解決して Client Provider に渡す。両言語の辞書をクライアントに同梱しない。ハイドレーション不整合（チラつき）を出さない。
- **`<html lang>`** を locale に応じて動的化する（現状 `lang="en"` 固定）。

## 3. 追加・変更するファイル

### 新規
| パス | 役割 |
|---|---|
| `frontend/lib/i18n/config.ts` | `locales = ['en','ja'] as const`、`defaultLocale = 'en'`、`Locale` 型、Cookie 名 `hiravi_locale` |
| `frontend/lib/i18n/dictionaries/en.ts` | 英語辞書（ネストしたキー構造） |
| `frontend/lib/i18n/dictionaries/ja.ts` | 日本語辞書（en と同一キー構造） |
| `frontend/lib/i18n/index.ts` | サーバ用 `getDictionary(locale)`、`getLocaleFromCookie()`（Cookie 未設定時は `Accept-Language` でロケールを推定）等 |
| `frontend/lib/i18n/locale-provider.tsx` | Client Context。`locale`・`t(key)`・`setLocale()` を供給。`t` はサーバから渡された辞書を引くだけ |
| `frontend/app/actions/locale.ts` | Server Action `setLocale(locale)`：Cookie 書き込み（App Router ではサーバ側で書く）。呼び出し後 `router.refresh()` で SSR 再取得 |
| `frontend/components/locale-toggle.tsx` | ヘッダーの JP/EN トグル UI |

### 変更
| パス | 変更内容 |
|---|---|
| `frontend/app/layout.tsx` | Cookie からロケール解決 → `<html lang={locale}>` を動的化 → `LocaleProvider` で `children` をラップ（`ClerkProvider` の内側でよい）。解決した辞書を Provider に渡す |
| `frontend/components/site-header.tsx` | `NAV` の `label`（`Browse`/`Dashboard`）、`Upload`/`Sign in`/`Sign up`/`Upload a deck`、メニュー aria を `t()` 化。`LocaleToggle` を `ThemeToggle` の隣に追加 |
| `frontend/components/deck-viewer.tsx` | **枠の文言のみ** `t()` 化（例: `{available.length} languages`、`aria-label="Reading language"` 等）。`lang` 状態・本文表示ロジックは不変 |
| `frontend/app/page.tsx` | ランディングの hero / CTA の文言を `t()` 化 |
| `frontend/app/dashboard/page.tsx` | UI 文言を `t()` 化（`No decks yet. Be the first to upload!`、`Categories:`、`Tags`、`Published` 等） |
| `frontend/app/upload/page.tsx` | アップロード画面の UI 文言を `t()` 化 |
| `frontend/app/browse/page.tsx` | 一覧画面の UI 文言を `t()` 化 |

## 4. 対象スコープ（明確な線引き）

### ✅ i18n 化する（UI 短文＝辞書方式）
- ランディング `app/page.tsx`（hero / CTA）
- ヘッダー `components/site-header.tsx`（ナビ・ボタン・メニュー）
- ビューワー枠 `components/deck-viewer.tsx`（chrome のみ）
- ダッシュボード `app/dashboard/page.tsx`
- アップロード `app/upload/page.tsx`
- ブラウズ `app/browse/page.tsx`

### ✅ i18n 化する（法務＝ロケール別「本文分割」方式。辞書には載せない）
対象: `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/security/page.tsx`（各75〜86行、ほぼ長文の散文）。

- 短文用の `t()` 辞書に**段落を入れない**こと（キー管理が破綻する）。
- 各ページに**コロケーションの本文モジュール**を作る。例: `app/privacy/content.tsx` が `{ en: <JSX本文>, ja: <JSX本文> }` をエクスポートし、`page.tsx` は現在のロケールで出し分け。`page.tsx` 自体の枠（見出し構造・レイアウト）は共通のまま。
- **日本語訳は既存の英語本文からドラフト翻訳**を生成する。各日本語本文の冒頭に `{/* 要法務確認: 暫定訳。正式文言に差し替え予定 */}` コメントを必ず入れる（後から正式文言に置換可能にする）。

### ⬜ 今回やらない（スコープ外）
- **Clerk 認証 UI**（サインイン/サインアップのモーダル）：英語のまま据え置き。
  - 将来揃える場合は `@clerk/localizations` の `jaJP` を `ClerkProvider` の `localization` に locale 連動で渡すだけ（数行）。今回は実装しない。
- **`metadata`（layout.tsx の title/description/OG）**：英語のまま据え置き（任意の follow-up）。
- ロケールルーティング、hreflang、next-intl 等。
- エラー/トースト文言の網羅：余力があれば対応可だが必須ではない。

## 5. 辞書構造の指針
- `en.ts` と `ja.ts` は**完全に同一のキー構造**を保つ（型で担保できると望ましい）。
- ネームスペースで分ける（例）:
  ```ts
  export const en = {
    nav: { browse: 'Browse', dashboard: 'Dashboard', upload: 'Upload', signIn: 'Sign in', signUp: 'Sign up' },
    home: { /* hero / cta */ },
    dashboard: { empty: 'No decks yet. Be the first to upload!', categories: 'Categories:', tags: 'Tags', published: 'Published' },
    upload: { /* ... */ },
    browse: { /* ... */ },
    viewer: { languagesCount: '{count} languages', readingLanguage: 'Reading language' },
  } as const
  ```
- 変数埋め込み（例 `{count} languages`）は簡易な置換ヘルパで対応（プレースホルダ `{name}` を replace する程度でよい。ライブラリ不要）。

## 6. 言語トグル UI（`locale-toggle.tsx`）
- 配置: `site-header.tsx` の `ThemeToggle` の隣。
- 形式: JP / EN の2値トグル（コンパクトに。`lucide-react` の適当なアイコン or テキスト "JA/EN" で可）。
- 動作: クリック → Server Action `setLocale` で Cookie 更新 → `router.refresh()` で再レンダ。
- 現ロケールが視覚的に分かること。

## 7. 受け入れ条件（Acceptance Criteria）
1. ヘッダーのトグルでスコープ内の全画面が JP ⇄ EN で即時切り替わる。
2. リロード後もロケールが保持される（Cookie）。SSR と一致しハイドレーションのチラつきが出ない。
3. `<html lang>` がロケールに追従する。
3-1. 初回アクセス（Cookie 未設定）時、日本語ブラウザでは日本語、それ以外のブラウザでは英語が初期表示される。トグルで切り替えると Cookie が優先され、ブラウザ言語と異なる言語にも固定できる。
4. **デッキ内容翻訳機能（`deck-viewer` の `lang`）は挙動不変**。
5. **Clerk のサインイン/サインアップ・モーダルは影響を受けない**（英語のまま正常動作）。
6. 法務3ページは JP/EN 両方が表示でき、日本語版に `要法務確認` コメントが入っている。
7. `cd frontend && pnpm build` が成功し、TypeScript エラーがない。
8. `pnpm lint` を通す。

## 8. ブランチ / PR
- ブランチ: `feature/i18n-ja-en`（main から）。
- PR を作成し、本仕様書（`docs/i18n-spec.md`）を参照すること。
- コミットメッセージは日本語。

## 9. 着手の出発点（Web セッション向け）
1. まず `frontend/lib/i18n/` の基盤（config / dictionaries / index / provider）と `app/actions/locale.ts` を作る。
2. `app/layout.tsx` を配線（locale 解決 → `<html lang>` → Provider）。
3. `locale-toggle.tsx` を作り `site-header.tsx` に組み込む（同時にヘッダー文言を `t()` 化）。
4. 残りの対象画面を1つずつ `t()` 化。
5. 法務ページを本文分割方式で対応。
6. `pnpm build` / `pnpm lint` で検証 → PR。
