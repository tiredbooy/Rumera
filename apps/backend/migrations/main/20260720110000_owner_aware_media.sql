-- +goose NO TRANSACTION

-- +goose Up

-- This migration changes database metadata and canonical URL values only. It
-- does not move, rename, copy, or delete any blob. Legacy flat UUID storage keys
-- remain valid and continue to be servable through GET /media/*key.
ALTER TABLE hero_slides
    ADD COLUMN IF NOT EXISTS image_storage_key TEXT,
    ADD COLUMN IF NOT EXISTS mobile_image_storage_key TEXT;

ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS image_storage_key TEXT,
    ADD COLUMN IF NOT EXISTS og_image_storage_key TEXT;

ALTER TABLE blogs
    ADD COLUMN IF NOT EXISTS image_storage_key TEXT;

COMMENT ON COLUMN hero_slides.image_storage_key IS
    'Relative local-media key paired with image_url; NULL for external or static images.';
COMMENT ON COLUMN hero_slides.mobile_image_storage_key IS
    'Relative local-media key paired with mobile_image_url; NULL for external or static images.';
COMMENT ON COLUMN recipes.image_storage_key IS
    'Relative local-media key paired with image_url; NULL for external or static images.';
COMMENT ON COLUMN recipes.og_image_storage_key IS
    'Relative local-media key paired with og_image_url; NULL for external or static images.';
COMMENT ON COLUMN blogs.image_storage_key IS
    'Relative local-media key paired with image_url; NULL for external or static images.';

CREATE OR REPLACE FUNCTION is_safe_media_storage_key(value TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
    SELECT octet_length(value) BETWEEN 1 AND 512
       AND value ~ '^[a-z0-9._/-]+$'
       AND left(value, 1) <> '/'
       AND right(value, 1) <> '/'
       AND position('//' IN value) = 0
       AND value !~ '(^|/)[^a-z0-9]'
       AND value !~ '[.](/|$)'
       AND NOT EXISTS (
           SELECT 1
           FROM unnest(string_to_array(value, '/')) AS parts(segment)
           WHERE octet_length(segment) > 255
       )
       AND value !~ '(^|/)(con|prn|aux|nul|com[1-9]|lpt[1-9])([.]|/|$)'
$$;

-- A NO TRANSACTION run may have created one or more indexes before failing to
-- record its Goose version. Drop them before backfill so a retry can temporarily
-- restore duplicate legacy keys, detach every shared owner, and recreate clean
-- indexes below. This also removes any invalid concurrent-index artifact.
DROP INDEX CONCURRENTLY IF EXISTS uq_hero_slides_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_hero_slides_mobile_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_recipes_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_recipes_og_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_blogs_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_product_images_storage_key;

-- Backfill only exact same-origin /media/<key> values whose key is a non-empty,
-- relative, forward-slash path of at most 512 bytes. External URLs, /images/...
-- values, and unsafe /media/... values deliberately retain a NULL key.
WITH candidates AS (
    SELECT id, substr(image_url, 8) AS storage_key
    FROM hero_slides
    WHERE left(image_url, 7) = '/media/'
)
UPDATE hero_slides AS h
SET image_storage_key = c.storage_key
FROM candidates AS c
WHERE h.id = c.id
  AND is_safe_media_storage_key(c.storage_key);

WITH candidates AS (
    SELECT id, substr(mobile_image_url, 8) AS storage_key
    FROM hero_slides
    WHERE left(mobile_image_url, 7) = '/media/'
)
UPDATE hero_slides AS h
SET mobile_image_storage_key = c.storage_key
FROM candidates AS c
WHERE h.id = c.id
  AND is_safe_media_storage_key(c.storage_key);

WITH candidates AS (
    SELECT id, substr(image_url, 8) AS storage_key
    FROM recipes
    WHERE left(image_url, 7) = '/media/'
)
UPDATE recipes AS r
SET image_storage_key = c.storage_key
FROM candidates AS c
WHERE r.id = c.id
  AND is_safe_media_storage_key(c.storage_key);

WITH candidates AS (
    SELECT id, substr(og_image_url, 8) AS storage_key
    FROM recipes
    WHERE left(og_image_url, 7) = '/media/'
)
UPDATE recipes AS r
SET og_image_storage_key = c.storage_key
FROM candidates AS c
WHERE r.id = c.id
  AND is_safe_media_storage_key(c.storage_key);

WITH candidates AS (
    SELECT id, substr(image_url, 8) AS storage_key
    FROM blogs
    WHERE left(image_url, 7) = '/media/'
)
UPDATE blogs AS b
SET image_storage_key = c.storage_key
FROM candidates AS c
WHERE b.id = c.id
  AND is_safe_media_storage_key(c.storage_key);

-- Keep safe product keys exactly where they are and make their persisted URL
-- environment-independent. Unsafe keys are detached from local ownership by
-- setting only storage_key to NULL; their existing image_url is left untouched.
UPDATE product_images
SET storage_key = NULL
WHERE storage_key IS NOT NULL
  AND NOT is_safe_media_storage_key(storage_key);

UPDATE product_images
SET image_url = '/media/' || storage_key
WHERE storage_key IS NOT NULL;

-- Historical rows may share one URL. Shared objects have no single safe owner,
-- so detach key ownership from every reference while preserving every URL and
-- blob. Derive references from canonical URLs, not current key columns: this
-- keeps retries and Down/Up cycles conservative after a prior run detached keys.
-- All table updates execute atomically as one statement and use no session-local
-- state, which is required because Goose may use different pooled connections
-- between statements in a NO TRANSACTION migration.
WITH media_references AS MATERIALIZED (
    SELECT substr(image_url, 8) AS storage_key
    FROM hero_slides
    WHERE left(image_url, 7) = '/media/'
      AND is_safe_media_storage_key(substr(image_url, 8))
    UNION ALL
    SELECT substr(mobile_image_url, 8)
    FROM hero_slides
    WHERE left(mobile_image_url, 7) = '/media/'
      AND is_safe_media_storage_key(substr(mobile_image_url, 8))
    UNION ALL
    SELECT substr(image_url, 8)
    FROM recipes
    WHERE left(image_url, 7) = '/media/'
      AND is_safe_media_storage_key(substr(image_url, 8))
    UNION ALL
    SELECT substr(og_image_url, 8)
    FROM recipes
    WHERE left(og_image_url, 7) = '/media/'
      AND is_safe_media_storage_key(substr(og_image_url, 8))
    UNION ALL
    SELECT substr(image_url, 8)
    FROM blogs
    WHERE left(image_url, 7) = '/media/'
      AND is_safe_media_storage_key(substr(image_url, 8))
    UNION ALL
    SELECT substr(image_url, 8)
    FROM product_images
    WHERE left(image_url, 7) = '/media/'
      AND is_safe_media_storage_key(substr(image_url, 8))
), shared_keys AS MATERIALIZED (
    SELECT storage_key
    FROM media_references
    GROUP BY storage_key
    HAVING count(*) > 1
), clear_hero_keys AS (
    UPDATE hero_slides
    SET image_storage_key = CASE
            WHEN image_storage_key IN (SELECT storage_key FROM shared_keys) THEN NULL
            ELSE image_storage_key
        END,
        mobile_image_storage_key = CASE
            WHEN mobile_image_storage_key IN (SELECT storage_key FROM shared_keys) THEN NULL
            ELSE mobile_image_storage_key
        END
    WHERE image_storage_key IN (SELECT storage_key FROM shared_keys)
       OR mobile_image_storage_key IN (SELECT storage_key FROM shared_keys)
    RETURNING id
), clear_recipe_keys AS (
    UPDATE recipes
    SET image_storage_key = CASE
            WHEN image_storage_key IN (SELECT storage_key FROM shared_keys) THEN NULL
            ELSE image_storage_key
        END,
        og_image_storage_key = CASE
            WHEN og_image_storage_key IN (SELECT storage_key FROM shared_keys) THEN NULL
            ELSE og_image_storage_key
        END
    WHERE image_storage_key IN (SELECT storage_key FROM shared_keys)
       OR og_image_storage_key IN (SELECT storage_key FROM shared_keys)
    RETURNING id
), clear_blog_keys AS (
    UPDATE blogs
    SET image_storage_key = NULL
    WHERE image_storage_key IN (SELECT storage_key FROM shared_keys)
    RETURNING id
)
UPDATE product_images
SET storage_key = NULL
WHERE storage_key IN (SELECT storage_key FROM shared_keys);

-- Recreate each ownership index only after shared legacy keys are detached.
CREATE UNIQUE INDEX CONCURRENTLY uq_hero_slides_image_storage_key
    ON hero_slides (image_storage_key)
    WHERE image_storage_key IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY uq_hero_slides_mobile_image_storage_key
    ON hero_slides (mobile_image_storage_key)
    WHERE mobile_image_storage_key IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY uq_recipes_image_storage_key
    ON recipes (image_storage_key)
    WHERE image_storage_key IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY uq_recipes_og_image_storage_key
    ON recipes (og_image_storage_key)
    WHERE og_image_storage_key IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY uq_blogs_image_storage_key
    ON blogs (image_storage_key)
    WHERE image_storage_key IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY uq_product_images_storage_key
    ON product_images (storage_key)
    WHERE storage_key IS NOT NULL;

ALTER TABLE hero_slides
    DROP CONSTRAINT IF EXISTS hero_slides_image_storage_key_safe_canonical,
    DROP CONSTRAINT IF EXISTS hero_slides_mobile_image_storage_key_safe_canonical;
ALTER TABLE hero_slides
    ADD CONSTRAINT hero_slides_image_storage_key_safe_canonical CHECK (
        image_storage_key IS NULL OR (
            is_safe_media_storage_key(image_storage_key)
            AND image_url IS NOT NULL
            AND image_url = '/media/' || image_storage_key
        )
    ) NOT VALID,
    ADD CONSTRAINT hero_slides_mobile_image_storage_key_safe_canonical CHECK (
        mobile_image_storage_key IS NULL OR (
            is_safe_media_storage_key(mobile_image_storage_key)
            AND mobile_image_url IS NOT NULL
            AND mobile_image_url = '/media/' || mobile_image_storage_key
        )
    ) NOT VALID;

ALTER TABLE recipes
    DROP CONSTRAINT IF EXISTS recipes_image_storage_key_safe_canonical,
    DROP CONSTRAINT IF EXISTS recipes_og_image_storage_key_safe_canonical;
ALTER TABLE recipes
    ADD CONSTRAINT recipes_image_storage_key_safe_canonical CHECK (
        image_storage_key IS NULL OR (
            is_safe_media_storage_key(image_storage_key)
            AND image_url IS NOT NULL
            AND image_url = '/media/' || image_storage_key
        )
    ) NOT VALID,
    ADD CONSTRAINT recipes_og_image_storage_key_safe_canonical CHECK (
        og_image_storage_key IS NULL OR (
            is_safe_media_storage_key(og_image_storage_key)
            AND og_image_url IS NOT NULL
            AND og_image_url = '/media/' || og_image_storage_key
        )
    ) NOT VALID;

ALTER TABLE blogs
    DROP CONSTRAINT IF EXISTS blogs_image_storage_key_safe_canonical;
ALTER TABLE blogs
    ADD CONSTRAINT blogs_image_storage_key_safe_canonical CHECK (
        image_storage_key IS NULL OR (
            is_safe_media_storage_key(image_storage_key)
            AND image_url IS NOT NULL
            AND image_url = '/media/' || image_storage_key
        )
    ) NOT VALID;

ALTER TABLE product_images
    DROP CONSTRAINT IF EXISTS product_images_storage_key_safe_canonical;
ALTER TABLE product_images
    ADD CONSTRAINT product_images_storage_key_safe_canonical CHECK (
        storage_key IS NULL OR (
            is_safe_media_storage_key(storage_key)
            AND image_url IS NOT NULL
            AND image_url = '/media/' || storage_key
        )
    ) NOT VALID;

-- +goose Down

ALTER TABLE product_images
    DROP CONSTRAINT IF EXISTS product_images_storage_key_safe_canonical;
ALTER TABLE blogs
    DROP CONSTRAINT IF EXISTS blogs_image_storage_key_safe_canonical;
ALTER TABLE recipes
    DROP CONSTRAINT IF EXISTS recipes_og_image_storage_key_safe_canonical,
    DROP CONSTRAINT IF EXISTS recipes_image_storage_key_safe_canonical;
ALTER TABLE hero_slides
    DROP CONSTRAINT IF EXISTS hero_slides_mobile_image_storage_key_safe_canonical,
    DROP CONSTRAINT IF EXISTS hero_slides_image_storage_key_safe_canonical;

DROP INDEX CONCURRENTLY IF EXISTS uq_product_images_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_blogs_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_recipes_og_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_recipes_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_hero_slides_mobile_image_storage_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_hero_slides_image_storage_key;

ALTER TABLE blogs
    DROP COLUMN IF EXISTS image_storage_key;
ALTER TABLE recipes
    DROP COLUMN IF EXISTS og_image_storage_key,
    DROP COLUMN IF EXISTS image_storage_key;
ALTER TABLE hero_slides
    DROP COLUMN IF EXISTS mobile_image_storage_key,
    DROP COLUMN IF EXISTS image_storage_key;

DROP FUNCTION IF EXISTS is_safe_media_storage_key(TEXT);

-- Up normalized safe product image URLs to environment-independent /media/...
-- values and detached unsafe/shared product keys. Down intentionally leaves
-- those data normalizations unchanged: prior origins and detached keys cannot
-- be reconstructed safely. No blob is moved or deleted in either direction.
