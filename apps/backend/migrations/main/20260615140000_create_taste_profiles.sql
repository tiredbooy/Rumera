-- +goose Up
-- A customer's self-declared taste preferences (categories, budget, flavour,
-- occasions), captured by an onboarding quiz and used to personalise the
-- storefront. Stored as JSONB so the shape can evolve without a migration.
CREATE TABLE IF NOT EXISTS taste_profiles (
    user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prefs      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS taste_profiles;
