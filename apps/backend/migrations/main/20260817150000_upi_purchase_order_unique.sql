-- +goose Up
-- A-2. Purchase recording used a non-atomic NOT EXISTS under READ COMMITTED, so
-- two concurrent webhook deliveries could both insert. Unique on
-- (user, product, order_id) for purchase rows; the insert uses ON CONFLICT.

DELETE FROM user_product_interactions a
USING user_product_interactions b
WHERE a.interaction_type = 'purchase'
  AND a.metadata ? 'order_id'
  AND b.interaction_type = 'purchase'
  AND b.metadata ? 'order_id'
  AND a.user_id = b.user_id
  AND a.product_id = b.product_id
  AND a.metadata->>'order_id' = b.metadata->>'order_id'
  AND a.id > b.id;

CREATE UNIQUE INDEX idx_upi_purchase_order
    ON user_product_interactions (user_id, product_id, (metadata->>'order_id'))
    WHERE interaction_type = 'purchase' AND metadata ? 'order_id';

-- +goose Down
DROP INDEX IF EXISTS idx_upi_purchase_order;
