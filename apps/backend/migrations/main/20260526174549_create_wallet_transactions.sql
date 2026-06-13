-- +goose Up
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id BIGSERIAL PRIMARY KEY,

    wallet_id BIGINT NOT NULL
        REFERENCES wallets(id)
        ON DELETE CASCADE,

    amount NUMERIC(20,2) NOT NULL
        CHECK (amount > 0),

    type VARCHAR(50) NOT NULL
        CHECK (
            type IN (
                'deposit',
                'withdraw',
                'purchase',
                'refund'
            )
        ),

    status VARCHAR(30) NOT NULL DEFAULT 'completed'
        CHECK (
            status IN (
                'pending',
                'completed',
                'failed',
                'cancelled'
            )
        ),

    balance_before NUMERIC(20,2),
    balance_after NUMERIC(20,2),

    reference_order_id BIGINT
        REFERENCES orders(id),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS wallet_transactions;

