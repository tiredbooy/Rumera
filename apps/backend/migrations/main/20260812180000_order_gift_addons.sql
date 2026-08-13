-- +goose Up
-- Modular gift packaging / add-ons (PH-060): fee + snapshot; include fee in total.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS gift_addons_fee NUMERIC(20, 2) NOT NULL DEFAULT 0
        CHECK (gift_addons_fee >= 0),
    ADD COLUMN IF NOT EXISTS gift_addons JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Recreate generated total to include gift add-ons fee.
ALTER TABLE orders DROP COLUMN IF EXISTS total_amount;
ALTER TABLE orders
    ADD COLUMN total_amount NUMERIC(20, 2) NOT NULL GENERATED ALWAYS AS
        (subtotal - discount_amount + shipping_cost + tax_amount + gift_addons_fee) STORED;

-- +goose Down
ALTER TABLE orders DROP COLUMN IF EXISTS total_amount;
ALTER TABLE orders DROP COLUMN IF EXISTS gift_addons;
ALTER TABLE orders DROP COLUMN IF EXISTS gift_addons_fee;
ALTER TABLE orders
    ADD COLUMN total_amount NUMERIC(20, 2) NOT NULL GENERATED ALWAYS AS
        (subtotal - discount_amount + shipping_cost + tax_amount) STORED;
