-- +goose Up
-- The order line model is variant-level: orderItemRepo.BulkCreate inserts
-- product_variant_id and orderRepo.GetItems selects it (the value drives stock
-- reserve/deduct). The column was referenced in code but never added to the
-- schema, so every checkout failed at BulkCreate. Add it now. order_items is
-- empty in practice (orders could never persist without it), so NOT NULL is safe.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS product_variant_id BIGINT NOT NULL REFERENCES product_variants(id);

CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items (product_variant_id);

-- +goose Down
DROP INDEX IF EXISTS idx_order_items_variant;
ALTER TABLE order_items DROP COLUMN IF EXISTS product_variant_id;
