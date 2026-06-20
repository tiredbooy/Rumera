-- +goose Up
-- Bring blogs to recipe-parity: a cover image for editorial journal cards, a
-- featured flag for the lead story, and an explicit publishing status so the
-- public listing/detail can hide drafts (mirrors the recipes publishing model).

ALTER TABLE blogs
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived'));

-- Back-fill: anything that already had a publish date is treated as published so
-- existing rows keep appearing on the storefront after the status gate lands.
UPDATE blogs SET status = 'published' WHERE published_at IS NOT NULL AND status = 'draft';

-- Published listing is the hottest public read path: filter by status, order by
-- recency, and skip soft-deleted rows.
CREATE INDEX IF NOT EXISTS idx_blogs_status_published_at
    ON blogs (status, published_at DESC)
    WHERE deleted_at IS NULL;

-- Featured lead-story lookup for the journal index.
CREATE INDEX IF NOT EXISTS idx_blogs_featured
    ON blogs (published_at DESC)
    WHERE is_featured = TRUE AND status = 'published' AND deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_blogs_featured;
DROP INDEX IF EXISTS idx_blogs_status_published_at;

ALTER TABLE blogs
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS is_featured,
    DROP COLUMN IF EXISTS image_url;
