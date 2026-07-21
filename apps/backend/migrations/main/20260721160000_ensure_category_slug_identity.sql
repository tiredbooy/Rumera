-- +goose Up
-- Category slugs are optional because structural grouping nodes may not have a
-- public route. Every non-null slug must still be one stable path-segment key.
-- Normalize historical path-breaking values before adding the constraints.
-- +goose StatementBegin
DO $$
DECLARE
    category_row RECORD;
    base_candidate TEXT;
    candidate TEXT;
    suffix INTEGER;
    whitespace_chars TEXT :=
        CHR(9) || CHR(10) || CHR(11) || CHR(12) || CHR(13) || CHR(32)
        || U&'\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000';
BEGIN
    FOR category_row IN
        SELECT id, slug
        FROM categories
        WHERE slug IS NOT NULL
        ORDER BY id
    LOOP
        IF BTRIM(category_row.slug, whitespace_chars) = '' THEN
            UPDATE categories SET slug = NULL WHERE id = category_row.id;
            CONTINUE;
        END IF;

        candidate := REGEXP_REPLACE(
            LOWER(BTRIM(category_row.slug)),
            '[^[:alnum:]]+',
            '-',
            'g'
        );
        candidate := BTRIM(candidate, '-');

        IF candidate = '' THEN
            candidate := 'category-' || category_row.id;
        END IF;
        base_candidate := LEFT(candidate, 220);
        candidate := base_candidate;
        suffix := 0;

        WHILE EXISTS (
            SELECT 1
            FROM categories
            WHERE slug = candidate AND id < category_row.id
        ) LOOP
            suffix := suffix + 1;
            candidate := LEFT(base_candidate, 190)
                || '-' || category_row.id || '-' || suffix;
        END LOOP;

        UPDATE categories SET slug = candidate WHERE id = category_row.id;
    END LOOP;
END $$;
-- +goose StatementEnd

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique
    ON categories (slug)
    WHERE slug IS NOT NULL;

ALTER TABLE categories
    ADD CONSTRAINT categories_slug_path_segment_check
    CHECK (
        slug IS NULL OR (
            slug = BTRIM(slug)
            AND slug <> ''
            AND slug = LOWER(slug)
            AND CHAR_LENGTH(slug) <= 255
            AND slug ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$'
        )
    );

-- +goose Down
ALTER TABLE categories
    DROP CONSTRAINT IF EXISTS categories_slug_path_segment_check;
DROP INDEX IF EXISTS idx_categories_slug_unique;
