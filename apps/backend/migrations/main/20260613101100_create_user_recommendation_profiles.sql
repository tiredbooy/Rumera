-- +goose Up
-- Denormalised per-user affinity profile. Recomputed periodically (cron or
-- admin trigger) from user_product_interactions + order history so that serving
-- "for you" is a single fast read instead of a heavy aggregation per request.

CREATE TABLE IF NOT EXISTS user_recommendation_profiles (
    user_id     BIGINT PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    -- Ranked affinities, highest score first.
    --   top_categories: [{"category_id": 12, "score": 8.5}]
    --   top_brands:     [{"brand_id": 4, "score": 6.0}]
    --   top_tags:       [{"tag_id": 31, "score": 3.0}]
    top_categories  JSONB NOT NULL DEFAULT '[]',
    top_brands      JSONB NOT NULL DEFAULT '[]',
    top_tags        JSONB NOT NULL DEFAULT '[]',

    -- Observed price comfort band (helps avoid recommending out-of-range items).
    preferred_price_min NUMERIC(20,2),
    preferred_price_max NUMERIC(20,2),

    -- Total weighted engagement — a quick proxy for how "warm" the profile is.
    engagement_score    NUMERIC(12,2) NOT NULL DEFAULT 0,

    last_interaction_at TIMESTAMPTZ,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_urp_computed_at
    ON user_recommendation_profiles (computed_at);

CREATE TRIGGER trg_user_recommendation_profiles_updated_at
BEFORE UPDATE ON user_recommendation_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS user_recommendation_profiles;
