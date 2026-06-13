-- +goose Up
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    code VARCHAR(80) UNIQUE,
    slug TEXT UNIQUE,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    country_of_origin VARCHAR(100),
    abv NUMERIC(5, 2),
    weight NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    meta_title VARCHAR(225),
    meta_description TEXT,
    meta_tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category_id
ON products(category_id);

CREATE INDEX idx_products_brand_id
ON products(brand_id);

CREATE UNIQUE INDEX idx_products_slug
ON products(slug);

CREATE INDEX idx_products_active
ON products(id)
WHERE is_active = true;


CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS products;
