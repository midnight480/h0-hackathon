-- Hiravi Aurora DSQL Schema
-- Note: DSQL does not support TEXT[] arrays, use JSONB instead

CREATE TABLE IF NOT EXISTS decks (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          TEXT        NOT NULL UNIQUE,
    title         TEXT        NOT NULL,
    description   TEXT        NOT NULL DEFAULT '',
    user_id       TEXT        NOT NULL,
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
    published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slides (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id      UUID    NOT NULL,
    page_number  INTEGER NOT NULL,
    image_key    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slide_texts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slide_id      UUID NOT NULL,
    language_code TEXT NOT NULL,
    content       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC IF NOT EXISTS idx_decks_user_id   ON decks (user_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_decks_status    ON decks (status);
CREATE INDEX ASYNC IF NOT EXISTS idx_decks_category  ON decks (category);
CREATE INDEX ASYNC IF NOT EXISTS idx_slides_deck_id  ON slides (deck_id, page_number);
CREATE INDEX ASYNC IF NOT EXISTS idx_slide_texts_slide_id ON slide_texts (slide_id, language_code);
