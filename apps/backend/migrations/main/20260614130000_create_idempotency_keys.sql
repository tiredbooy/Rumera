-- +goose Up
-- Idempotency keys make at-least-once callers (payment gateway webhooks,
-- client retries) safe: the first request claims a row and records its
-- response; replays return the stored response without re-running the side
-- effect. response_code = 0 marks a claim that is still processing.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key           TEXT        PRIMARY KEY,
    request_hash  TEXT        NOT NULL,
    response_code INT         NOT NULL DEFAULT 0,
    response_body BYTEA,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports housekeeping that prunes old keys (e.g. a periodic DELETE of rows
-- older than the retention window).
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys (created_at);

-- +goose Down
DROP TABLE IF EXISTS idempotency_keys;
