-- +goose Up
-- Product and variant galleries have independent ordering and primary images.
-- Repair historical ownership before enforcing that a variant image names the
-- same product as its parent variant.
LOCK TABLE product_images IN SHARE ROW EXCLUSIVE MODE;

UPDATE product_images AS image
SET product_id = variant.product_id,
    updated_at = NOW()
FROM product_variants AS variant
WHERE image.product_variant_id = variant.id
  AND image.product_id IS DISTINCT FROM variant.product_id;

ALTER TABLE product_variants
    ADD CONSTRAINT product_variants_id_product_id_key UNIQUE (id, product_id);

ALTER TABLE product_images
    DROP CONSTRAINT product_images_product_variant_id_fkey,
    ADD CONSTRAINT product_images_variant_requires_product
        CHECK (product_variant_id IS NULL OR product_id IS NOT NULL),
    ADD CONSTRAINT product_images_variant_product_fkey
        FOREIGN KEY (product_variant_id, product_id)
        REFERENCES product_variants (id, product_id)
        ON DELETE CASCADE;

WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY product_id, product_variant_id
               ORDER BY is_primary DESC, sort_order ASC, id ASC
           ) AS primary_rank,
           row_number() OVER (
               PARTITION BY product_id, product_variant_id
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

DROP INDEX uq_product_images_one_primary;

CREATE UNIQUE INDEX uq_product_images_one_product_primary
    ON product_images (product_id)
    WHERE product_id IS NOT NULL
      AND product_variant_id IS NULL
      AND is_primary;

CREATE UNIQUE INDEX uq_product_images_one_variant_primary
    ON product_images (product_variant_id)
    WHERE product_variant_id IS NOT NULL AND is_primary;

-- +goose Down
LOCK TABLE product_images IN SHARE ROW EXCLUSIVE MODE;

DROP INDEX uq_product_images_one_variant_primary;
DROP INDEX uq_product_images_one_product_primary;

ALTER TABLE product_images
    DROP CONSTRAINT product_images_variant_product_fkey,
    DROP CONSTRAINT product_images_variant_requires_product,
    ADD CONSTRAINT product_images_product_variant_id_fkey
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variants (id)
        ON DELETE CASCADE;

ALTER TABLE product_variants
    DROP CONSTRAINT product_variants_id_product_id_key;

-- Restore the previous one-primary-per-product invariant deterministically.
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY product_id
               ORDER BY is_primary DESC, sort_order ASC, id ASC
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
WHERE image.id = ranked.id;

CREATE UNIQUE INDEX uq_product_images_one_primary
    ON product_images (product_id)
    WHERE product_id IS NOT NULL AND is_primary;
