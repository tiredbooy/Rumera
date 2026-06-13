-- +goose Up
CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,

    product_variant_id BIGINT NOT NULL UNIQUE
        REFERENCES product_variants(id)
        ON DELETE CASCADE,

    stock_on_hand INTEGER NOT NULL DEFAULT 0
        CHECK (stock_on_hand >= 0),

    committed_stock INTEGER NOT NULL DEFAULT 0
        CHECK (committed_stock >= 0),

    reorder_point INTEGER NOT NULL DEFAULT 0
        CHECK (reorder_point >= 0),

    reorder_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (reorder_quantity >= 0),

    last_restock_at TIMESTAMPTZ,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- +goose Down
DROP TABLE IF EXISTS inventory;
