-- +goose NO TRANSACTION

-- +goose Up
-- Hot-path indexes for the payment / wallet / inventory tables, which the audit
-- found had none — every webhook confirm, wallet statement and stock-movement
-- lookup was a sequential scan. Created CONCURRENTLY so production picks them up
-- without locking writes.

-- Payment webhook resolves a transaction by its gateway id; the duplicate-payment
-- guard filters by (order_id, status). Both were full-table scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_txid
    ON payment_transactions (transaction_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_order_status
    ON payment_transactions (order_id, status);

-- Wallet statement listing always filters wallet_id and sorts created_at DESC.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_wallet_created
    ON wallet_transactions (wallet_id, created_at DESC);

-- Inventory movement audit: by variant (most-recent first) and by source order.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_variant_created
    ON inventory_movements (product_variant_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_order
    ON inventory_movements (reference_order_id)
    WHERE reference_order_id IS NOT NULL;

-- Revenue/admin reporting filters orders by paid_at; partial keeps it small.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_paid_at
    ON orders (paid_at)
    WHERE paid_at IS NOT NULL;

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_paid_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_movements_order;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_movements_variant_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_wallet_transactions_wallet_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_payment_transactions_order_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_payment_transactions_txid;
