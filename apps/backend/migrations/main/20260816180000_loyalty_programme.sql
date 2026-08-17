-- +goose Up
-- PR-003f: persist Cellar Club rates/tiers + enabled kill-switch.
-- Dedicated tables (not site_settings). Env LOYALTY_* is seed/fallback only.
-- Singleton programme row (id = 1). Four named tiers; no earn multipliers.

CREATE TABLE IF NOT EXISTS loyalty_programme (
    id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    earn_divisor    DOUBLE PRECISION NOT NULL CHECK (earn_divisor > 0),
    redeem_value    DOUBLE PRECISION NOT NULL CHECK (redeem_value > 0),
    signup_bonus    INTEGER NOT NULL CHECK (signup_bonus >= 0),
    review_bonus    INTEGER NOT NULL CHECK (review_bonus >= 0),
    birthday_bonus  INTEGER NOT NULL CHECK (birthday_bonus >= 0),
    birthday_tz     VARCHAR(64) NOT NULL,
    referral_reward INTEGER NOT NULL CHECK (referral_reward >= 0),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_loyalty_programme_updated_at
BEFORE UPDATE ON loyalty_programme
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS loyalty_programme_tiers (
    id                  VARCHAR(20) PRIMARY KEY,
    min_lifetime_points INTEGER NOT NULL CHECK (min_lifetime_points >= 0),
    sort_order          INTEGER NOT NULL,
    CHECK (id IN ('bronze', 'silver', 'gold', 'cellar'))
);

INSERT INTO loyalty_programme (
    id, enabled, earn_divisor, redeem_value,
    signup_bonus, review_bonus, birthday_bonus, birthday_tz, referral_reward
) VALUES (
    1, TRUE, 10000, 1000,
    100, 50, 200, 'Asia/Tehran', 300
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO loyalty_programme_tiers (id, min_lifetime_points, sort_order) VALUES
    ('bronze', 0, 1),
    ('silver', 1000, 2),
    ('gold', 5000, 3),
    ('cellar', 20000, 4)
ON CONFLICT (id) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS loyalty_programme_tiers;
DROP TABLE IF EXISTS loyalty_programme;
