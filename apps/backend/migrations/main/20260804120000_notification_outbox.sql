-- +goose Up
-- Durable notification outbox + delivery ledger for Kafka-backed workers.
-- Producers write outbox rows in the same transaction as domain changes;
-- a relay publishes to Kafka; workers record deliveries for idempotency.

CREATE TABLE IF NOT EXISTS notification_outbox (
    id              BIGSERIAL PRIMARY KEY,
    topic           TEXT        NOT NULL,
    partition_key   TEXT        NOT NULL,
    payload         JSONB       NOT NULL,
    idempotency_key TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ,
    publish_error   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_outbox_idempotency_uidx
    ON notification_outbox (idempotency_key);

CREATE INDEX IF NOT EXISTS notification_outbox_unpublished_idx
    ON notification_outbox (created_at ASC)
    WHERE published_at IS NULL;

-- Successful (or intentionally skipped) deliveries — consumer side.
CREATE TABLE IF NOT EXISTS notification_deliveries (
    idempotency_key TEXT PRIMARY KEY,
    topic           TEXT        NOT NULL,
    event_id        TEXT        NOT NULL,
    channel         TEXT        NOT NULL,
    delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meta            JSONB
);

-- +goose Down
DROP TABLE IF EXISTS notification_deliveries;
DROP TABLE IF EXISTS notification_outbox;
