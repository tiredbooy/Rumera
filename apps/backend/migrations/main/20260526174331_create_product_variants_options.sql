-- +goose Up
CREATE TABLE IF NOT EXISTS product_variants_options (
    id BIGSERIAL PRIMARY KEY,
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE UNIQUE,
    variant_option_id BIGINT NOT NULL REFERENCES option_values(id) ON DELETE CASCADE UNIQUE
);

-- +goose Down
DROP TABLE IF EXISTS product_variants_options;
