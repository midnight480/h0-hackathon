# 要件分析質問票 — 公開識別子（Google Meet 形式 slug）の設計

対話で「Google Meet 形式（小文字英字 3-4-3 ハイフン区切り・10文字）のランダム ID／カスタム入力なし」という方針は固まりました。
一方、既存コードには**すでに 2 つの公開識別子**が存在するため、これらをどう整理するかを確定させたいです。各設問の `[Answer]:` タグの後ろに回答（A〜X）と必要なら補足を記入してください。

---

## 前提：現状の識別子（調査結果）

| 識別子 | 形式 | 採番場所 | 用途URL |
|---|---|---|---|
| `id` (UUID) | `gen_random_uuid()` | DSQL DEFAULT | 内部主キー（URLには露出しない） |
| `slug` (TEXT UNIQUE) | `タイトルkebab + UUID先頭8桁`（例 `my-deck-a1b2c3d4`） | frontend `upload.ts` | 主URL `/@{user}/{slug}` |
| `short_id` (VARCHAR(8)) | ランダム8桁hex（例 `a1b2c3d4`） | frontend `upload.ts` | ショートURL `/s/{short_id}` → 主URLへ301リダイレクト |

> 関連コード: `frontend/app/actions/upload.ts:56-68`, `src/schema/schema.sql:4-26`, `frontend/app/[user]/[slug]/page.tsx`, `frontend/app/s/[code]/route.ts`

---

## Question 1: Google Meet 形式 ID を「どの識別子」に適用するか（最重要）

A) **`short_id` のみ置き換え**: ショートURL `/s/xxx` の8桁hex を Meet形式（`abc-defg-hij`）に変更。主URLのタイトルベース `slug`（`/@user/slug`）は現状維持。
   → 変更が最小。「読みやすい主URL ＋ 共有用ショートURL」の二段構えを維持。
B) **主URL の `slug` を Meet形式に置き換え**: タイトルベース slug を廃止し、主URL を `/@{user}/{meet-id}` または `/d/{meet-id}` のような Meet形式 ID にする。`short_id` は廃止して一本化。
   → URL からタイトル文字列は消えるが、識別子が1つに統一されシンプル。
C) **Meet形式を唯一の公開IDに統合**: ユーザー名やタイトルに依存しない `/{meet-id}` 単独ルートにし、`slug`・`short_id` を共に Meet形式 ID へ統合。
   → 最もシンプル（Notion/Meet に近い）。既存の `/@user/slug` ルーティングは作り直し。
X) Other (please describe after [Answer]: tag below)

[Answer]: B（主URL を Meet形式に一本化。`short_id` 廃止。`/@{user}/{meet-id}`）

---

## Question 2: 主URLでのタイトル文字列（人間可読部分）の扱い

A) **タイトル部分は不要**: 純粋に Meet形式 ID だけでよい（例 `/d/abc-defg-hij`）。
B) **Notion 風に「タイトル＋ID」**: 読みやすさのため `タイトル-abc-defg-hij` のように接頭辞を付けるが、ルーティングは ID 部分のみで判定（タイトル部は飾り）。
C) **現状の `/@user/slug` 構造を維持したい**（Q1 で A を選んだ場合に該当）。
X) Other (please describe after [Answer]: tag below)

[Answer]: B（ID のみ。タイトル接頭辞なし。主URL は `/@{user}/{meet-id}`）

---

## Question 3: 既存データ（既存デッキ）の移行

A) **移行不要**: ハッカソン段階で本番データは無い／DB はリセット可能。新形式のみ実装すればよい。
B) **移行が必要**: 既存デッキに後付けで Meet形式 ID を採番し、旧URLも維持/リダイレクトしたい。
X) Other (please describe after [Answer]: tag below)

[Answer]: B（既存デッキへ後付け採番＋旧URLリダイレクト維持）

---

## Question 4: ID の採番場所

A) **現状どおり frontend（server action `upload.ts`）で採番**する。
B) **別の場所で採番**したい（例: Lambda 処理側、DB の DEFAULT 関数など）。
X) Other (please describe after [Answer]: tag below)

[Answer]: A（現状どおり frontend `upload.ts` で採番）

---

## 確認済み事項（対話で合意済み・このまま採用予定。異論あれば各 [Answer] に記入）

- **形式**: 小文字英字 a–z のみ・10文字・`3-4-3` ハイフン区切り（例 `abc-defg-hij`）／数字なし
- **カスタム入力**: 採用しない（ランダム一本化）
- **保存（正規キー）**: ハイフン無し10文字 `abcdefghij` を canonical として保存
- **検索（ルックアップ）**: 入力からハイフンを除去してから一致検索（ハイフン有無どちらでもヒット＝寛容）
- **生成**: NanoID（辞書 `a-z`・長さ10）
- **一意性**: 当該カラムに UNIQUE 制約、衝突時のみ再生成リトライ
- **DSQL**: OCC 前提。ランダムでキーが分散するため同時INSERT衝突はほぼ発生しない。UNIQUE違反／OCCコンフリクト(OC001)の双方を catch して再試行

[Answer]（上記に異論・修正があれば記入。無ければ「合意」とだけ記入）: 
