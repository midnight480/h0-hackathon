# Code Generation サマリ — slug-identifier ユニット

## 目的
デッキの公開識別子を **Google Meet 形式**（小文字英字 a–z・10文字、表示は `3-4-3` ハイフン区切り、例 `abc-defg-hij`）のランダムID（NanoID）に一本化する。

## 確定済み設計（変更なし）
- ID形式: `^[a-z]{10}$`（数字/大文字なし）。表示は 3-4-3。生成は NanoID。
- カスタム入力は不採用。保存は正規形、検索はハイフン除去で寛容一致。
- `slug` を正規形10文字に再定義（UNIQUE 維持）。`legacy_slug` で旧 slug 保持。
- `short_id`(VARCHAR(8)) は旧URL（/s/{code}）リダイレクト専用に流用（新規採番なし）。
- 採番場所は server action `frontend/app/actions/upload.ts`。

## 生成・変更ファイル
| ファイル | 区分 | 内容 |
|----------|------|------|
| `frontend/lib/public-id.ts` | 新規 | `generatePublicId` / `formatPublicId` / `normalizePublicId` / `isCanonicalId` |
| `frontend/lib/public-id.test.ts` | 新規 | ユニットテスト（vitest） |
| `src/schema/schema.sql` | 変更 | `legacy_slug TEXT` 列・`idx_decks_legacy_slug` 追加、slug/short_id の役割をコメント明記 |
| `frontend/app/actions/upload.ts` | 変更 | `toSlug`/`generateShortId` 削除、`generatePublicId` 採番、UNIQUE/OCC リトライ（最大5回）、表示形を戻り値に追加 |
| `frontend/app/[user]/[slug]/page.tsx` | 変更 | 正規化→正規形検索、未ヒット時 legacy_slug 検索で新URLへ redirect |
| `frontend/app/s/[code]/route.ts` | 変更 | 新URL形式（3-4-3 表示形）リダイレクト |
| `src/scripts/migrate-public-id.ts` | 新規 | 既存デッキの slug 移行（冪等・衝突リトライ・short_id 温存） |
| `frontend/package.json` | 変更 | `nanoid` 追加、`test`(vitest) スクリプト追加 |
| `src/package.json` | 変更 | `nanoid` 追加、`db:schema` / `db:migrate-public-id` スクリプト追加 |

## リトライ対象エラー判定
pg の SQLSTATE（`code`）で判定: `23505`(unique_violation) / `40001`(serialization_failure) / `OC*`(DSQL OCC)。

## ステータス
- [x] Code Generation 完了
