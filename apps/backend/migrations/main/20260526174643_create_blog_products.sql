-- +goose Up
CREATE TABLE IF NOT EXISTS blog_products (
    id BIGSERIAL PRIMARY KEY,
    blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE IF EXISTS blog_products;
