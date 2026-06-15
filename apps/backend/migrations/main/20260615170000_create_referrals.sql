-- +goose Up
-- Referral programme. Each customer has one stable code; a referee can be
-- referred at most once (UNIQUE referee). The referral completes — and both
-- sides earn points — when the referee's first order is paid.
CREATE TABLE IF NOT EXISTS referral_codes (
    user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code       VARCHAR(16) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
    id               BIGSERIAL PRIMARY KEY,
    referrer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_user_id  BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    reward_points    INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,

    CONSTRAINT referrals_no_self CHECK (referrer_user_id <> referee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_user_id);

-- +goose Down
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS referral_codes;
