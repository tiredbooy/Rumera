-- +goose NO TRANSACTION

-- +goose Up
-- CE-10. A journal post had no OG image of its own: social and search cards
-- reused the article cover, which is cropped for a 4:3 hero and reads badly at
-- 1.91:1. Recipes already carry a dedicated slot; this gives blogs the same one,
-- with the identical storage-key pairing and safety constraint.
ALTER TABLE blogs
    ADD COLUMN IF NOT EXISTS og_image_url TEXT,
    ADD COLUMN IF NOT EXISTS og_image_storage_key TEXT;

COMMENT ON COLUMN blogs.og_image_storage_key IS
    'Relative local-media key paired with og_image_url; NULL for external or static images.';

-- One owner per stored blob: the same guarantee uq_recipes_og_image_storage_key
-- gives recipe OG images, so cleanup can never delete a blob another row still
-- points at through this column.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_blogs_og_image_storage_key
    ON blogs (og_image_storage_key)
    WHERE og_image_storage_key IS NOT NULL;

ALTER TABLE blogs
    DROP CONSTRAINT IF EXISTS blogs_og_image_storage_key_safe_canonical;
ALTER TABLE blogs
    ADD CONSTRAINT blogs_og_image_storage_key_safe_canonical CHECK (
        og_image_storage_key IS NULL OR (
            is_safe_media_storage_key(og_image_storage_key)
            AND og_image_url IS NOT NULL
            AND og_image_url = '/media/' || og_image_storage_key
        )
    ) NOT VALID;

-- +goose Down
ALTER TABLE blogs
    DROP CONSTRAINT IF EXISTS blogs_og_image_storage_key_safe_canonical;

DROP INDEX CONCURRENTLY IF EXISTS uq_blogs_og_image_storage_key;

ALTER TABLE blogs
    DROP COLUMN IF EXISTS og_image_url,
    DROP COLUMN IF EXISTS og_image_storage_key;
