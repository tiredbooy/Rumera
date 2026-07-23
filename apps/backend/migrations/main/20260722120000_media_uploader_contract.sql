-- +goose Up

ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS image_alt VARCHAR(255);

ALTER TABLE blogs
    ADD COLUMN IF NOT EXISTS image_alt VARCHAR(255);

ALTER TABLE product_images
    ALTER COLUMN alt_text TYPE VARCHAR(255);

-- Block gallery writers while historical state and its enforcing index become
-- visible together. A regular transactional index is deliberate here: startup
-- migrations must not expose a normalized-but-unconstrained intermediate state.
LOCK TABLE product_images IN SHARE ROW EXCLUSIVE MODE;

UPDATE product_images
SET is_primary = false
WHERE is_primary IS NULL;

ALTER TABLE product_images
    ALTER COLUMN is_primary SET DEFAULT false,
    ALTER COLUMN is_primary SET NOT NULL;

-- Normalize historical gallery state before enforcing the invariants used by
-- the uploader. Every product with images gets one primary image and contiguous
-- ordering; stable id order breaks legacy ties deterministically.
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY product_id
                ORDER BY is_primary DESC NULLS LAST, sort_order ASC, id ASC
           ) AS primary_rank,
           row_number() OVER (
               PARTITION BY product_id
               ORDER BY sort_order ASC, id ASC
           ) - 1 AS normalized_order
    FROM product_images
    WHERE product_id IS NOT NULL
)
UPDATE product_images AS image
SET is_primary = ranked.primary_rank = 1,
    sort_order = ranked.normalized_order,
    updated_at = NOW()
FROM ranked
WHERE image.id = ranked.id
  AND (
      image.is_primary IS DISTINCT FROM (ranked.primary_rank = 1)
      OR image.sort_order IS DISTINCT FROM ranked.normalized_order
  );

DROP INDEX IF EXISTS uq_product_images_one_primary;

CREATE UNIQUE INDEX uq_product_images_one_primary
    ON product_images (product_id)
    WHERE product_id IS NOT NULL AND is_primary;

-- +goose Down

DROP INDEX IF EXISTS uq_product_images_one_primary;

ALTER TABLE product_images
    ALTER COLUMN is_primary DROP NOT NULL;

UPDATE product_images
SET alt_text = left(alt_text, 80)
WHERE char_length(alt_text) > 80;

ALTER TABLE product_images
    ALTER COLUMN alt_text TYPE VARCHAR(80);

ALTER TABLE blogs
    DROP COLUMN IF EXISTS image_alt;

ALTER TABLE recipes
    DROP COLUMN IF EXISTS image_alt;
