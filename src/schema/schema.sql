-- Hiravi Aurora DSQL Schema
-- Note: DSQL does not support TEXT[] arrays, use JSONB instead

CREATE TABLE IF NOT EXISTS decks (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- slug: 公開識別子の正規形（Google Meet 形式・小文字英字10文字 `^[a-z]{10}$`）。UNIQUE を維持。
    slug          TEXT        NOT NULL UNIQUE,
    -- legacy_slug: 移行前の旧 slug（タイトル由来）を保持。旧URLリダイレクト用。
    legacy_slug   TEXT,
    title         TEXT        NOT NULL,
    description   TEXT        NOT NULL DEFAULT '',
    user_id       TEXT        NOT NULL,
    -- username: 公開URL `/@{user}/{slug}` の `{user}` 用に非正規化保存する Clerk username（小文字化）。
    -- Clerk の Restrict changes=ON により不変のため陳腐化しない。未設定ユーザーは NULL（user_id へフォールバック）。
    username      TEXT,
    category      TEXT        NOT NULL DEFAULT 'other',
    tags          JSONB       NOT NULL DEFAULT '[]',
    original_language  TEXT   NOT NULL DEFAULT 'en',
    target_languages   JSONB  NOT NULL DEFAULT '[]',
    slide_count   INTEGER     NOT NULL DEFAULT 0,
    views         INTEGER     NOT NULL DEFAULT 0,
    likes         INTEGER     NOT NULL DEFAULT 0,
    status        TEXT        NOT NULL DEFAULT 'pending',
    file_key      TEXT,
    cover_image_key TEXT,
    is_public     BOOLEAN,
    -- short_id: 旧URL（/s/{code}）リダイレクト専用に流用。新規採番は行わない。
    short_id      VARCHAR(8),
    published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- 既存テーブルへのべき等な列追加（apply-schema による再適用を想定）。
-- CREATE TABLE IF NOT EXISTS だけでは既存テーブルに列が追加されないため、明示的に ALTER する。
ALTER TABLE decks ADD COLUMN IF NOT EXISTS legacy_slug TEXT;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS username TEXT;

CREATE TABLE IF NOT EXISTS slides (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id      UUID    NOT NULL,
    page_number  INTEGER NOT NULL,
    image_key    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- layout: オーバーレイ表示（B案）用のブロック配列。1スライド分の全言語訳文を
-- まとめて保持する。各要素は bbox（ページ幅/高さに対する 0..1 正規化）、フォント
-- サイズ fs（ページ高に対する正規化）、背景色 bg、各言語の訳文 t を持つ。
-- 既存行ありテーブルでも確実に通るよう nullable で追加する（legacy_slug/username と同様）。
-- backend は常に値を INSERT し、frontend は NULL を空配列として扱うため挙動は等価。
-- 旧デッキの行は NULL のまま（= オーバーレイ無し）となり、既存表示は従来どおり動く。
ALTER TABLE slides ADD COLUMN IF NOT EXISTS layout JSONB;

CREATE TABLE IF NOT EXISTS slide_texts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slide_id      UUID NOT NULL,
    language_code TEXT NOT NULL,
    content       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- liker_id: Clerk user_id (authenticated) or "anon:<uuid>" (anonymous, cookie-backed)
CREATE TABLE IF NOT EXISTS deck_likes (
    deck_id    UUID        NOT NULL,
    liker_id   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (deck_id, liker_id)
);

CREATE INDEX ASYNC IF NOT EXISTS idx_decks_user_id   ON decks (user_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_decks_status    ON decks (status);
CREATE INDEX ASYNC IF NOT EXISTS idx_decks_category  ON decks (category);
CREATE INDEX ASYNC IF NOT EXISTS idx_slides_deck_id  ON slides (deck_id, page_number);
CREATE INDEX ASYNC IF NOT EXISTS idx_slide_texts_slide_id ON slide_texts (slide_id, language_code);
CREATE INDEX ASYNC IF NOT EXISTS idx_deck_likes_deck_id ON deck_likes (deck_id);
-- 旧URLリダイレクト（legacy_slug 一致）検索用インデックス。
CREATE INDEX ASYNC IF NOT EXISTS idx_decks_legacy_slug ON decks (legacy_slug);
-- username による公開URL解決（Clerk API を呼ばず DSQL で直接検索）用インデックス。
CREATE INDEX ASYNC IF NOT EXISTS idx_decks_username ON decks (username);
