# ドメインエンティティ — slug-identifier

## エンティティ: Deck（`decks` テーブル）— 識別子関連のみ

| カラム | 型 | 変更 | 役割 |
|---|---|---|---|
| `id` | UUID PK | 変更なし | 内部主キー（URL非露出） |
| `slug` | TEXT NOT NULL UNIQUE | **意味変更** | **公開識別子の正規形**。Meet形式IDのハイフン無し10文字（`^[a-z]{10}$`）を格納 |
| `legacy_slug` | TEXT NULL | **新設** | 旧タイトルベースslug（`{kebab}-{8hex}`）。旧URLリダイレクト用。新規デッキは NULL |
| `short_id` | VARCHAR(8) NULL | **役割変更（流用）** | 既存値＝旧8桁hexショートID。`/s/{code}` リダイレクト用に保持。**新規デッキには採番しない（NULL）** |
| `title` | TEXT NOT NULL | 変更なし | 表示用タイトル（URLには含めない） |
| その他 | — | 変更なし | — |

### 制約・インデックス
- `slug`: UNIQUE 制約を維持（正規形10文字の一意性を保証）。
- `legacy_slug`: リダイレクト検索用に INDEX を付与（`idx_decks_legacy_slug`）。UNIQUE にはしない（理論上の旧データ重複を移行で弾く）。
- `short_id`: `/s/{code}` 検索用。既存運用を踏襲（必要なら INDEX 追加）。

## 値オブジェクト: PublicId

- **正規形 (canonical)**: `^[a-z]{10}$`（小文字英字10文字）。DB保存・一意性判定・内部比較に使用。
- **表示形 (display)**: `^[a-z]{3}-[a-z]{4}-[a-z]{3}$`（例 `abc-defg-hij`）。URL生成・UI表示に使用。
- **相互変換**:
  - `format(canonical) = canonical[0:3] + "-" + canonical[3:7] + "-" + canonical[7:10]`
  - `normalize(input) = input.replace(/-/g, "").toLowerCase()`
- **不変条件**: `normalize(format(c)) === c` が常に成立すること。

## 関係
- 1 Deck は 1 PublicId を持つ（`slug` に格納）。
- 旧識別子（`legacy_slug`, `short_id`）は移行済みデッキにのみ存在しうる（リダイレクト解決のための従属属性）。
