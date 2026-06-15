-- +goose Up
-- Recurring "cellar box" subscriptions. The renewal job emails the customer when
-- a box is due and advances next_renewal_at. (Auto-charging is deferred until a
-- tokenized recurring payment method is available — see FEATURE-ROADMAP.md.)
CREATE TABLE IF NOT EXISTS subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan            VARCHAR(50) NOT NULL DEFAULT 'cellar-box',
    cadence         VARCHAR(20) NOT NULL CHECK (cadence IN ('monthly', 'quarterly')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'cancelled')),
    address_id      BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    next_renewal_at TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_due
    ON subscriptions (next_renewal_at) WHERE status = 'active';

-- +goose Down
DROP TABLE IF EXISTS subscriptions;
