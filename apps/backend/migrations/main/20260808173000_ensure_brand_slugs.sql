-- +goose Up
ALTER TABLE brands ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Backfill stable human-readable slugs from the unique brand title. Collisions
-- receive a deterministic id suffix rather than exposing ids in normal URLs.
-- +goose StatementBegin
DO $$
DECLARE
    brand_row RECORD;
    base_candidate TEXT;
    candidate TEXT;
    suffix INTEGER;
BEGIN
    FOR brand_row IN
        SELECT id, title
        FROM brands
        WHERE slug IS NULL OR BTRIM(slug) = ''
        ORDER BY id
    LOOP
        candidate := REGEXP_REPLACE(
            LOWER(BTRIM(brand_row.title)),
            '[^[:alnum:]]+',
            '-',
            'g'
        );
        candidate := BTRIM(candidate, '-');
        IF candidate = '' THEN
            candidate := 'brand-' || brand_row.id;
        END IF;

        base_candidate := LEFT(candidate, 220);
        candidate := base_candidate;
        suffix := 0;
        WHILE EXISTS (
            SELECT 1 FROM brands
            WHERE slug = candidate AND id <> brand_row.id
        ) LOOP
            suffix := suffix + 1;
            candidate := LEFT(base_candidate, 190)
                || '-' || brand_row.id || '-' || suffix;
        END LOOP;

        UPDATE brands SET slug = candidate WHERE id = brand_row.id;
    END LOOP;
END $$;
-- +goose StatementEnd

ALTER TABLE brands ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_slug_unique ON brands (slug);

-- Idempotent: Down is non-destructive (slugs stay in the public URL contract),
-- so re-running Up after Down must not fail when the check already exists.
-- +goose StatementBegin
DO $$
BEGIN
    ALTER TABLE brands
        ADD CONSTRAINT brands_slug_path_segment_check
        CHECK (
            slug = BTRIM(slug)
            AND slug <> ''
            AND slug = LOWER(slug)
            AND CHAR_LENGTH(slug) <= 255
            AND slug ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$'
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
-- +goose StatementEnd

-- +goose Down
-- Non-destructive: brand slugs become part of the public URL contract.
SELECT 1;
