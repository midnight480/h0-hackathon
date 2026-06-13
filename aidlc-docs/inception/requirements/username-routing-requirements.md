# 要件定義書 — 公開URLの user 部分を Clerk username 化

## インテント分析サマリ

| 項目 | 内容 |
|---|---|
| **ユーザー要求** | 公開URL `/@{user}/{slug}` の `{user}` を、長く非可読な Clerk `user_id`（`user_3F2L…`）から、サインアップ時に必須化した **username**（短く可読）へ置き換える。 |
| **リクエスト種別** | Enhancement（識別子の可読性向上・slug 刷新の第2弾） |
| **スコープ** | Single Component（frontend ルーティング/表示 + DSQL スキーマ + バックフィル） |
| **複雑度** | Moderate（スキーマ追加・既存データバックフィル・ルーティング解決・旧URLリダイレクト） |
| **対象プロジェクト** | Hiravi（Brownfield） |

### 前提条件（解消済み）
- Clerk 設定: `Sign-up with username=ON` / `Require username=ON` / **`Restrict changes=ON`（変更禁止）** / `Sign-in with username=ON` / min6・max64 / numeric off / extended off。
- `Require username` は**新規サインアップのみ**適用。既存ユーザーは遡及付与されないため、管理者が Dashboard で付与する。
- 既存4デッキの所有者（`user_3F2L…`）には username `midnight480` を付与済み（バックフィル方式の有効性を実証）。

### 重要な設計含意
- **`Restrict changes=ON` により username は実質不変（immutable）**。
  → 「username 変更時の旧URLリダイレクト/履歴保持」は**不要**。
  → `user.updated` webhook による同期も**不要**。
  → DB に username を非正規化保存しても**陳腐化しない**（安全）。

---

## 機能要件（Functional Requirements）

### FR-1: スキーマ拡張
- `decks` に `username TEXT`（NULL 可）を追加する。NULL 許可はフォールバック（FR-5）のため。
- 検索用に `idx_decks_username` を付与する。
- `user_id`（既存）は**正準FKとして維持**（username は表示・ルーティング用の非正規化値）。

### FR-2: デッキ作成時の username 保存
- `createDeckRecord`（`frontend/app/actions/upload.ts`）で、認証ユーザーの username を Clerk から取得し `decks.username` に保存する。
- username が取得できない場合は NULL を保存（FR-5 フォールバック対象）。
- 採番（slug）ロジックは既存のまま。

### FR-3: ルーティング解決（`/@{user}/{slug}`）
`frontend/app/[user]/[slug]/page.tsx` で `{user}`（先頭 `@` 除去後 = `raw`）を以下の順で解決する。
1. **`raw` が `^user_` 形式（Clerk user_id）の場合**（＝旧URL）:
   - `user_id = raw AND slug = <normalized>` で検索。ヒットすれば:
     - 所有者に username があれば **`/@{username}/{format(slug)}` へ 301 リダイレクト**。
     - username が無ければ（フォールバック）そのまま表示。
   - 未ヒットなら 404。
2. **それ以外（＝username）の場合**:
   - `username = raw AND slug = <normalized>` で検索。ヒットすれば表示。
   - 未ヒットなら 404。
- slug 側の正規化・寛容ルックアップ（既存 BR）は維持。
- 既存の公開/非公開（`is_public`・所有者）判定は維持。

### FR-4: 表示・リンク生成の username 化
- `decks.username`（無ければ `user_id`）を著者識別子として表示・リンクに使う。
- 該当箇所: `app/[user]/[slug]/page.tsx`（`author.username = r.user_id` を実username へ）, `app/page.tsx`, `app/dashboard/page.tsx`, `app/[user]/page.tsx`, `components/deck-card.tsx`, `components/deck-viewer.tsx`。
- ショートURL `app/s/[code]/route.ts` のリダイレクト先を `/@{username}/{format(slug)}`（無ければ user_id）に変更。

### FR-5: フォールバック（username 未設定）
- username が空のユーザーは、従来どおり `user_id` を URL に用いる（`/@user_xxx/slug` も有効）。
- 既存の `lib/clerk-users.ts` の `u.username || id` 方針と整合させる。

### FR-6: 既存データのバックフィル
- 既存デッキの `decks.username` を、所有者 `user_id` から Clerk Backend API で解決して一括設定する。
- 冪等（既に設定済み or username 解決不可はスキップ）。
- 当面の対象は4件（すべて `midnight480`）。
- Clerk Secret Key を用いる移行スクリプト（`migrate-public-id.ts` と同様の TS スクリプト）。

---

## 非機能要件（Non-Functional Requirements）

### NFR-1: パフォーマンス / グローバル低レイテンシ
- 公開ページ閲覧・一覧表示で **Clerk API を呼ばず**、`decks.username`（indexed）で解決 → DSQL マルチリージョンの低レイテンシを活かす。

### NFR-2: 一意性・整合性
- Clerk が username の一意性を保証（username→ユーザーは 1:1）。
- username は不変のため、非正規化値が陳腐化しない。

### NFR-3: 大文字小文字の扱い
- username 比較は case の揺れに備える（保存値と検索値の正規化方針を Functional Design で確定）。Clerk 既定の一意性ルールに合わせる。

### NFR-4: 後方互換
- 旧 `user_id` URL（直近の slug 移行で生成）は 301 で username 形式へ誘導し、リンク切れを防ぐ。

### NFR-5: 可読性 / UX
- URL から長い `user_3F2L…` を排し、`/@midnight480/abc-defg-hij` の可読URLにする。

---

## スコープ外（Out of Scope）
- username 変更への追従（immutable のため不要）。
- `user.updated` webhook 同期（不要）。
- プロフィールページの再設計・username 編集UI。
- 既存ユーザーへの username 一括強制付与の自動化（管理者が Dashboard/API で実施）。

---

## 主要設計上の決定（確認済み）
| 論点 | 決定 |
|---|---|
| 解決方式 | **DB 非正規化**（`decks.username` 追加、作成時保存＋バックフィル、username で直接検索） |
| username 変更 | 対応不要（Clerk `Restrict changes=ON` で不変） |
| 旧 user_id URL | **username 形式へ 301 リダイレクト**（`user_` プレフィックスで判定） |
| 未設定フォールバック | **実装する**（username 空なら user_id を使用） |
| 同期 | webhook 不要 |

---

## 影響範囲（既存コード）
- `src/schema/schema.sql`（`decks.username` 列＋`idx_decks_username`）
- `frontend/app/actions/upload.ts`（作成時に username 保存）
- `frontend/app/[user]/[slug]/page.tsx`（username 解決・旧user_id 301・author 表示）
- `frontend/app/s/[code]/route.ts`（リダイレクト先を username 形式へ）
- `frontend/app/page.tsx` / `app/dashboard/page.tsx` / `app/[user]/page.tsx`（一覧の author username）
- `frontend/components/deck-card.tsx` / `components/deck-viewer.tsx`（リンク・著者表示）
- `frontend/lib/clerk-users.ts`（既存フォールバック方針と整合）
- 新規バックフィルスクリプト（`src/scripts/`）

---

## 主要要件サマリ
- 公開URLの `{user}` を Clerk **username** に置換（`/@midnight480/abc-defg-hij`）。
- `decks.username` を非正規化保存（作成時＋バックフィル）、username で直接検索（Clerk 呼ばず）。
- username は不変のため同期不要。
- 旧 `user_id` URL は 301 で username 形式へ。
- username 未設定時は user_id フォールバック。
