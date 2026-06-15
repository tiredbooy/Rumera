-- +goose Up
-- Digital gift cards. Issued by staff (promotions / support credit / sold), then
-- redeemed by a customer into their wallet. Single-use: redemption is a guarded
-- status transition so a code can't be redeemed twice.
CREATE TABLE IF NOT EXISTS gift_cards (
    id                BIGSERIAL PRIMARY KEY,
    code              VARCHAR(24) UNIQUE NOT NULL,
    initial_amount    NUMERIC(20, 2) NOT NULL CHECK (initial_amount > 0),
    status            VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'redeemed', 'disabled')),
    purchaser_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    redeemed_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    redeemed_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS gift_cards;
