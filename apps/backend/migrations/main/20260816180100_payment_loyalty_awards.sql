-- +goose Up
-- PR-003h: durable post-Confirm earn intent (payments-owned).
-- Written in the same Confirm TX as money/stock so a paid order is never
-- forgotten if AwardForOrder fails after commit. awarded_at stays NULL
-- until AwardForOrder succeeds; leftover rows are retried (do not delete).

CREATE TABLE IF NOT EXISTS payment_loyalty_awards (
    order_id    BIGINT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      NUMERIC(20, 2) NOT NULL CHECK (amount >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    awarded_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_loyalty_awards_pending_idx
    ON payment_loyalty_awards (created_at ASC)
    WHERE awarded_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS payment_loyalty_awards_pending_idx;
DROP TABLE IF EXISTS payment_loyalty_awards;
