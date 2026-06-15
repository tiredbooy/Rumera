-- +goose Up
-- Loyalty ("Cellar Club"): a points balance per customer plus an append-only
-- ledger. The ledger's UNIQUE(reason, ref_type, ref_id) makes awarding
-- idempotent — a retried order-paid webhook can't grant points twice.
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    points_balance  INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
    tier            VARCHAR(20) NOT NULL DEFAULT 'bronze',
    tier_since      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta      INTEGER NOT NULL,          -- + earned, - redeemed
    reason     VARCHAR(40) NOT NULL,      -- order_paid | signup | redeem | redeem_reversal | ...
    ref_type   VARCHAR(40) NOT NULL,
    ref_id     VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (reason, ref_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON loyalty_transactions (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS loyalty_transactions;
DROP TABLE IF EXISTS loyalty_accounts;
