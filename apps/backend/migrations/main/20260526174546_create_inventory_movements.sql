-- +goose Up
CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGSERIAL PRIMARY KEY,

    product_variant_id BIGINT NOT NULL
        REFERENCES product_variants(id)
        ON DELETE CASCADE,

    quantity INTEGER NOT NULL,

    type VARCHAR(50) NOT NULL
        CHECK (
            type IN (
                'purchase',
                'restock',
                'refund',
                'adjustment',
                'reservation',
                'release',
                'damage'
            )
        ),

    reference_order_id BIGINT
        REFERENCES orders(id),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS inventory_movements;