-- +goose Up
CREATE TABLE IF NOT EXISTS option_values (
    id BIGSERIAL PRIMARY KEY,
    variant_id BIGINT REFERENCES option_types(id) ON DELETE CASCADE,
    value VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS option_values;