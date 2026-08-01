-- +goose Up
-- Historically Reserve decremented stock_on_hand while also incrementing
-- committed_stock, even though every read derives availability by subtracting
-- committed stock. Restore stock_on_hand to physical stock before enforcing the
-- canonical invariant.
LOCK TABLE inventory IN SHARE ROW EXCLUSIVE MODE;

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM inventory
        WHERE stock_on_hand::bigint + committed_stock > 2147483647
    ) THEN
        RAISE EXCEPTION 'inventory stock normalization exceeds INTEGER range';
    END IF;
END $$;
-- +goose StatementEnd

UPDATE inventory
SET stock_on_hand = stock_on_hand + committed_stock
WHERE committed_stock > 0;

ALTER TABLE inventory
    ADD CONSTRAINT inventory_committed_not_above_on_hand
    CHECK (committed_stock <= stock_on_hand) NOT VALID;

ALTER TABLE inventory
    VALIDATE CONSTRAINT inventory_committed_not_above_on_hand;

-- +goose Down
ALTER TABLE inventory
    DROP CONSTRAINT inventory_committed_not_above_on_hand;

UPDATE inventory
SET stock_on_hand = stock_on_hand - committed_stock
WHERE committed_stock > 0;
