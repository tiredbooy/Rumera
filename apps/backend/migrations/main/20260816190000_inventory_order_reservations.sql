-- +goose Up
-- PR-020b: bind committed stock to a per-order reservation row.
-- committed_stock stays the sellable counter; this table is the identity so
-- a failed webhook cannot release order A's hold and let a late succeed
-- deduct order B's committed units.

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id                 BIGSERIAL PRIMARY KEY,
    order_id           BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity           INTEGER NOT NULL CHECK (quantity > 0),
    status             VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_reservations_status_check
        CHECK (status IN ('active', 'released', 'deducted')),
    CONSTRAINT inventory_reservations_order_variant_key
        UNIQUE (order_id, product_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant
    ON inventory_reservations (product_variant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_active
    ON inventory_reservations (order_id)
    WHERE status = 'active';

CREATE TRIGGER trg_inventory_reservations_updated_at
BEFORE UPDATE ON inventory_reservations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- In-flight unpaid checkouts still hold committed stock against order_items.
-- Give them an active row so Deduct/Release stay order-scoped after deploy.
INSERT INTO inventory_reservations (order_id, product_variant_id, quantity, status)
SELECT
    oi.order_id,
    oi.product_variant_id,
    SUM(oi.quantity)::int,
    'active'
FROM order_items oi
INNER JOIN orders o ON o.id = oi.order_id
WHERE o.status = 'pending'
GROUP BY oi.order_id, oi.product_variant_id
ON CONFLICT (order_id, product_variant_id) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS inventory_reservations;
