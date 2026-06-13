-- +goose Up
-- First-party interaction log that powers personalized recommendations.
--
-- This lives in the MAIN database (not the analytics TimescaleDB) on purpose:
-- recommendations need to JOIN against the live catalogue (products, variants,
-- categories, brands, tags) with int64 keys, which the UUID-keyed analytics
-- warehouse cannot do cheaply. Analytics events remain the source of truth for
-- BI; this table is the lean, query-optimised signal for serving recs.

CREATE TABLE IF NOT EXISTS user_product_interactions (
    id          BIGSERIAL PRIMARY KEY,

    user_id     BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    product_id  BIGINT NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,

    -- The kind of signal. Each carries a different implicit-feedback strength.
    interaction_type VARCHAR(30) NOT NULL
        CHECK (interaction_type IN (
            'view',
            'add_to_cart',
            'purchase',
            'wishlist',
            'review',
            'recipe_view',
            'search_click'
        )),

    -- Tunable strength of this signal (purchase ≫ view). Defaults are applied in
    -- the service layer so weights can evolve without a migration.
    weight      NUMERIC(6,2) NOT NULL DEFAULT 1.0
        CHECK (weight >= 0),

    -- Where the interaction originated (product_page, recipe, search, etc.).
    source      VARCHAR(40),

    -- Free-form context (variant_id, recipe_id, query, position, …).
    metadata    JSONB NOT NULL DEFAULT '{}',

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user recent history — the core read for "for you" and profile building.
CREATE INDEX IF NOT EXISTS idx_upi_user_created
    ON user_product_interactions (user_id, created_at DESC);

-- Per-product aggregation for trending / popularity.
CREATE INDEX IF NOT EXISTS idx_upi_product_created
    ON user_product_interactions (product_id, created_at DESC);

-- Affinity lookups (has this user engaged with this product before?).
CREATE INDEX IF NOT EXISTS idx_upi_user_product
    ON user_product_interactions (user_id, product_id);

CREATE INDEX IF NOT EXISTS idx_upi_type_created
    ON user_product_interactions (interaction_type, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS user_product_interactions;
