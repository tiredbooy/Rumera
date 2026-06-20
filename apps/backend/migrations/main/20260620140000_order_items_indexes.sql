-- +goose NO TRANSACTION

-- +goose Up
-- order_items had no index on its foreign keys (Postgres does not create them
-- automatically). The audit found this is one of the fastest-growing tables and
-- is sequential-scanned by every hot read that touches it:
--   * order detail               -> order_repo.GetItems (filters order_id)
--   * "frequently bought together" rail -> recommendation_repo self-join on product_id
--   * home "trending" rail        -> aggregates by product_id
--   * nightly taste-profile recompute -> joins order_items by product_id
-- Created CONCURRENTLY so production picks them up without locking writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
    ON order_items (order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
    ON order_items (product_id);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS idx_order_items_product_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_order_items_order_id;
