-- +goose Up

CREATE TABLE IF NOT EXISTS blogs (
    id BIGSERIAL PRIMARY KEY,

    author_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    slug TEXT NOT NULL UNIQUE,

    content TEXT NOT NULL,

    excerpt TEXT,

    time_to_read INTEGER NOT NULL DEFAULT 1
        CHECK (time_to_read > 0),

    total_reads BIGINT NOT NULL DEFAULT 0
        CHECK (total_reads >= 0),

    meta_title VARCHAR(255),

    meta_description TEXT,

    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_blogs_author_id
ON blogs(author_id);

CREATE INDEX idx_blogs_published_at
ON blogs(published_at DESC);

CREATE INDEX idx_blogs_active
ON blogs(published_at DESC)
WHERE deleted_at IS NULL;

CREATE TRIGGER trg_blogs_updated_at
BEFORE UPDATE ON blogs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TABLE IF EXISTS blogs;