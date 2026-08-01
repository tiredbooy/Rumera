-- +goose Up
-- Existing rows predate an identity constraint. Keep the earliest relationship
-- before adding the index that makes additive tag writes idempotent and powers
-- product-leading catalogue lookups.
DELETE FROM product_tags duplicate
USING product_tags canonical
WHERE duplicate.product_id = canonical.product_id
  AND duplicate.tag_id = canonical.tag_id
  AND duplicate.id > canonical.id;

CREATE UNIQUE INDEX IF NOT EXISTS product_tags_product_id_tag_id_uidx
    ON product_tags (product_id, tag_id);

-- +goose Down
DROP INDEX IF EXISTS product_tags_product_id_tag_id_uidx;
