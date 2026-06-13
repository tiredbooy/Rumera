-- +goose Up
-- recipe_products is the curated "Shop this recipe" upsell list. Give it the
-- presentation metadata the storefront needs to merchandise it: ordering, a
-- hero product, and a role so the UI can group bottles by purpose.

ALTER TABLE recipe_products
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS role VARCHAR(40);  -- base_spirit, mixer, garnish, recommended

-- At most one hero product per recipe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_products_one_primary
    ON recipe_products (recipe_id)
    WHERE is_primary = TRUE;

-- +goose Down
DROP INDEX IF EXISTS idx_recipe_products_one_primary;

ALTER TABLE recipe_products
    DROP COLUMN IF EXISTS role,
    DROP COLUMN IF EXISTS is_primary,
    DROP COLUMN IF EXISTS sort_order;
