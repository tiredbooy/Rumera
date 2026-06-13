-- +goose Up
-- Enrich recipes for a real content-commerce surface: publishing workflow,
-- engagement tracking, drink-specific metadata, and first-class SEO fields so
-- recipe pages rank and convert.

ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS excerpt TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0
        CHECK (view_count >= 0),
    -- Total time is always prep + cook, so derive it once at the DB level.
    ADD COLUMN IF NOT EXISTS total_time_minutes INTEGER
        GENERATED ALWAYS AS (prep_time_minutes + cook_time_minutes) STORED,
    ADD COLUMN IF NOT EXISTS calories INTEGER
        CHECK (calories IS NULL OR calories >= 0),
    -- Drink-specific taxonomy (helps both UX filters and rich snippets).
    ADD COLUMN IF NOT EXISTS cocktail_type VARCHAR(80),   -- e.g. cocktail, mocktail, punch, shot
    ADD COLUMN IF NOT EXISTS glass_type VARCHAR(80),      -- e.g. highball, coupe, rocks
    ADD COLUMN IF NOT EXISTS serving_suggestion TEXT,
    -- SEO surface.
    ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS meta_description TEXT,
    ADD COLUMN IF NOT EXISTS meta_keywords TEXT[],
    ADD COLUMN IF NOT EXISTS canonical_url TEXT,
    ADD COLUMN IF NOT EXISTS og_image_url TEXT;

-- Published listing is the hottest read path: filter by status, order by recency.
CREATE INDEX IF NOT EXISTS idx_recipes_status_published_at
    ON recipes (status, published_at DESC);

-- Featured carousels on the storefront.
CREATE INDEX IF NOT EXISTS idx_recipes_featured
    ON recipes (published_at DESC)
    WHERE is_featured = TRUE AND status = 'published';

-- Trending / most-viewed modules.
CREATE INDEX IF NOT EXISTS idx_recipes_view_count
    ON recipes (view_count DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_recipes_view_count;
DROP INDEX IF EXISTS idx_recipes_featured;
DROP INDEX IF EXISTS idx_recipes_status_published_at;

ALTER TABLE recipes
    DROP COLUMN IF EXISTS og_image_url,
    DROP COLUMN IF EXISTS canonical_url,
    DROP COLUMN IF EXISTS meta_keywords,
    DROP COLUMN IF EXISTS meta_description,
    DROP COLUMN IF EXISTS meta_title,
    DROP COLUMN IF EXISTS serving_suggestion,
    DROP COLUMN IF EXISTS glass_type,
    DROP COLUMN IF EXISTS cocktail_type,
    DROP COLUMN IF EXISTS calories,
    DROP COLUMN IF EXISTS total_time_minutes,
    DROP COLUMN IF EXISTS view_count,
    DROP COLUMN IF EXISTS is_featured,
    DROP COLUMN IF EXISTS published_at,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS excerpt;
