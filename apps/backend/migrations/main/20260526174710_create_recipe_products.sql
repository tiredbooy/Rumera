-- +goose Up
CREATE TABLE IF NOT EXISTS recipe_products (
    id BIGSERIAL PRIMARY KEY,

    recipe_id BIGINT NOT NULL
        REFERENCES recipes(id)
        ON DELETE CASCADE,

    product_variant_id BIGINT NOT NULL
        REFERENCES product_variants(id)
        ON DELETE CASCADE,

    quantity NUMERIC(10,2)
        CHECK (quantity >= 0),

    unit VARCHAR(50),

    UNIQUE(recipe_id, product_variant_id)
);

CREATE INDEX idx_recipe_products_recipe_id
ON recipe_products(recipe_id);

CREATE INDEX idx_recipe_products_variant_id
ON recipe_products(product_variant_id);

-- +goose Down
DROP TABLE IF EXISTS recipe_products;
