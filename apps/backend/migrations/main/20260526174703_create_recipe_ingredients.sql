-- +goose Up
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id BIGSERIAL PRIMARY KEY,

    recipe_id BIGINT NOT NULL
        REFERENCES recipes(id)
        ON DELETE CASCADE,

    product_variant_id BIGINT
        REFERENCES product_variants(id)
        ON DELETE SET NULL,

    ingredient_name VARCHAR(255) NOT NULL,

    quantity NUMERIC(10,2)
        CHECK (quantity >= 0),

    unit VARCHAR(50),

    optional BOOLEAN NOT NULL DEFAULT FALSE,

    notes TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipe_ingredients_recipe_id
ON recipe_ingredients(recipe_id);

CREATE INDEX idx_recipe_ingredients_variant_id
ON recipe_ingredients(product_variant_id);

CREATE TRIGGER trg_recipe_ingredients_updated_at
BEFORE UPDATE ON recipe_ingredients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TABLE IF EXISTS recipe_ingredients;
