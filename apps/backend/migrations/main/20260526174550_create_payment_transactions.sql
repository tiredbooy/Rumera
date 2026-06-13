-- +goose Up
CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(20, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'IRT',
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
    payment_method payment_method NOT NULL,
    transaction_id VARCHAR(250) NOT NULL, -- ID from payment gateway
    raw_response JSONB, -- store full gateway response for auditing/debugging,
    error_message TEXT, -- store error message if payment failed,
    paid_at TIMESTAMPTZ, -- Need to push it after payment got succeed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS payment_transactions;
