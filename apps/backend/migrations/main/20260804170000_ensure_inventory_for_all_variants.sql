-- +goose Up
-- Every sellable variant must have an inventory row so admin stock tools and
-- reservations never fail with "not found" for brand-new variants.
INSERT INTO inventory (
    product_variant_id,
    stock_on_hand,
    committed_stock,
    reorder_point,
    reorder_quantity
)
SELECT
    pv.id,
    0,
    0,
    5,
    24
FROM product_variants pv
WHERE NOT EXISTS (
    SELECT 1 FROM inventory i WHERE i.product_variant_id = pv.id
);

-- +goose Down
-- Keep inventory history; do not delete backfilled rows on down.
