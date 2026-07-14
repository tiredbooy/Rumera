-- +goose Up
-- Consolidate any historical duplicate cart lines before enforcing the conflict
-- target used by cartRepository.AddItem.
WITH grouped AS (
    SELECT cart_id,
           product_variant_id,
           MIN(id) AS keep_id,
           SUM(quantity) AS total_quantity
    FROM cart_items
    GROUP BY cart_id, product_variant_id
)
UPDATE cart_items ci
SET quantity = grouped.total_quantity,
    updated_at = NOW()
FROM grouped
WHERE ci.id = grouped.keep_id;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY cart_id, product_variant_id
               ORDER BY id ASC
           ) AS position
    FROM cart_items
)
DELETE FROM cart_items ci
USING ranked
WHERE ci.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_cart_variant
    ON cart_items (cart_id, product_variant_id);

-- +goose Down
DROP INDEX IF EXISTS uq_cart_items_cart_variant;
