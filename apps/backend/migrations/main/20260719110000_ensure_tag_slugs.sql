-- +goose Up
-- The slug was added to the historical create migration after some databases
-- had already applied it. Keep those installations compatible with fresh ones.
ALTER TABLE tags ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- +goose StatementBegin
DO $$
DECLARE
    tag_row RECORD;
    candidate TEXT;
    suffix INTEGER;
BEGIN
    FOR tag_row IN
        SELECT id
        FROM tags
        WHERE slug IS NULL OR BTRIM(slug) = ''
        ORDER BY id
    LOOP
        suffix := 0;
        candidate := 'tag-' || tag_row.id;
        WHILE EXISTS (
            SELECT 1 FROM tags WHERE slug = candidate AND id <> tag_row.id
        ) LOOP
            suffix := suffix + 1;
            candidate := 'tag-' || tag_row.id || '-' || suffix;
        END LOOP;

        UPDATE tags SET slug = candidate WHERE id = tag_row.id;
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM tags
        GROUP BY slug
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'tags.slug contains duplicate values';
    END IF;
END $$;
-- +goose StatementEnd

ALTER TABLE tags ALTER COLUMN slug SET NOT NULL;

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'tags'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[(
              SELECT attnum::SMALLINT
              FROM pg_attribute
              WHERE attrelid = 'tags'::regclass AND attname = 'slug'
          )]::SMALLINT[]
    ) THEN
        ALTER TABLE tags ADD CONSTRAINT tags_slug_key UNIQUE (slug);
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- Intentionally non-destructive: slug is part of the canonical tags schema.
SELECT 1;
