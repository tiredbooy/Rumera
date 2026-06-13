-- +goose NO TRANSACTION

-- +goose Up
-- Primary-image lookup used by orderRepository.GetItems and product detail. The
-- partial index stays tiny (only is_primary rows) and turns the per-item image
-- resolution into an index scan instead of a sequential scan of product_images.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_images_primary
    ON product_images (product_id)
    WHERE is_primary = true;

-- Variant-image lookup (recipe shoppable-products LATERAL join in recipe_repo).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_images_variant
    ON product_images (product_variant_id)
    WHERE product_variant_id IS NOT NULL;

-- "List my orders" filters by user_id and sorts by created_at DESC. The existing
-- single-column idx_orders_user_id can satisfy the filter but not the sort; this
-- composite serves both in one index scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_created
    ON orders (user_id, created_at DESC);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_user_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_images_variant;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_images_primary;
