-- +goose Up
CREATE TABLE IF NOT EXISTS product_tags (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE IF EXISTS product_tags;
