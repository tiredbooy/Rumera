-- +goose Up
-- PR-020r: optional parcel tracking (not the shipping-method rate carrier).
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS parcel_carrier TEXT;

-- +goose Down
ALTER TABLE orders
    DROP COLUMN IF EXISTS tracking_number,
    DROP COLUMN IF EXISTS parcel_carrier;
