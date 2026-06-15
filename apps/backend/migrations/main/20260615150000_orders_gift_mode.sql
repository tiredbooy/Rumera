-- +goose Up
-- Gift mode: let a customer mark an order as a gift (wrap, message, hidden price
-- on the packing slip, and an optional preferred delivery date).
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS is_gift                 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS gift_message            TEXT,
    ADD COLUMN IF NOT EXISTS gift_wrap               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hide_price              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS scheduled_delivery_date TIMESTAMPTZ;

-- +goose Down
ALTER TABLE orders
    DROP COLUMN IF EXISTS is_gift,
    DROP COLUMN IF EXISTS gift_message,
    DROP COLUMN IF EXISTS gift_wrap,
    DROP COLUMN IF EXISTS hide_price,
    DROP COLUMN IF EXISTS scheduled_delivery_date;
