-- +goose Up
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT REFERENCES carts(id),
    product_variant_id BIGINT REFERENCES product_variants(id),
    quantity INTEGER NOT NULL DEFAULT 0
        CHECK (quantity > 0),
    unit_price_snapshot NUMERIC(20, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cart_id
ON cart_items(cart_id);

CREATE INDEX idx_cart_product_variant_id
ON cart_items(product_variant_id);

CREATE TRIGGER trg_cart_items_updated_at
BEFORE UPDATE ON cart_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS cart_items;
