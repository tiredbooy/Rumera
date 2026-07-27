-- +goose Up
CREATE TABLE product_aggregate_operations (
    operation_id UUID PRIMARY KEY,
    request_hash CHAR(64) NOT NULL,
    product_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_aggregate_operations_created_at
    ON product_aggregate_operations (created_at);

-- +goose Down
DROP TABLE product_aggregate_operations;
