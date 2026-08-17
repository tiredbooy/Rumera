-- +goose Up
-- ED-001: durable domain-fact outbox. Producers INSERT in the same Postgres
-- transaction as the business write, so a fact can never exist without its
-- money/catalog row (and vice versa). A relay publishes to Kafka when
-- EVENTS_BUS=kafka; otherwise the local worker consumes straight from here.
--
-- domain_events holds facts ("the order was paid"). notification_outbox stays
-- the command stream ("send this SMS") — they are deliberately not merged.

CREATE TABLE IF NOT EXISTS domain_events (
    id               BIGSERIAL   PRIMARY KEY,
    event_id         UUID        NOT NULL,
    type             TEXT        NOT NULL,
    source           TEXT        NOT NULL,
    subject          TEXT        NOT NULL,
    partition_key    TEXT        NOT NULL,
    spec_version     TEXT        NOT NULL DEFAULT '1.0',
    occurred_at      TIMESTAMPTZ NOT NULL,
    data             JSONB       NOT NULL,
    correlation_id   TEXT,
    causation_id     TEXT,
    traceparent      TEXT,
    idempotency_key  TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Relay-to-Kafka bookkeeping. Unused (stays NULL) when EVENTS_BUS=postgres.
    published_at     TIMESTAMPTZ,
    publish_attempts INT         NOT NULL DEFAULT 0,
    publish_after    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    publish_error    TEXT,
    -- Set once consumption rows have been fanned out for this event.
    dispatched_at    TIMESTAMPTZ
);

-- The producer-side exactly-once guard: a replayed webhook or a double Confirm
-- collapses to one fact.
CREATE UNIQUE INDEX IF NOT EXISTS uq_domain_events_idempotency_key
    ON domain_events (idempotency_key);

-- ClaimDue loads each claimed row's fact by envelope UUID, so this is on the
-- hot path of every consume tick. It also enforces envelope-id uniqueness,
-- which the single-row lookup already assumes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_domain_events_event_id
    ON domain_events (event_id);

-- Relay scan: unpublished and due. Partial so the index stays tiny once the
-- backlog drains.
CREATE INDEX IF NOT EXISTS idx_domain_events_unpublished
    ON domain_events (publish_after ASC, id ASC)
    WHERE published_at IS NULL;

-- Local fan-out scan.
CREATE INDEX IF NOT EXISTS idx_domain_events_undispatched
    ON domain_events (id ASC)
    WHERE dispatched_at IS NULL;

-- Retention sweep + operator lookups by type.
CREATE INDEX IF NOT EXISTS idx_domain_events_type_created_at
    ON domain_events (type, created_at DESC);

-- Per-consumer delivery ledger. One row per (event, consumer) is what makes the
-- effect exactly-once while delivery stays at-least-once. Keyed on the envelope
-- UUID rather than the BIGSERIAL so a Kafka consumer can upsert without first
-- looking up the local primary key.
CREATE TABLE IF NOT EXISTS domain_event_consumptions (
    event_id      UUID        NOT NULL,
    consumer      TEXT        NOT NULL,
    event_pk      BIGINT      NOT NULL,
    type          TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'pending',
    attempts      INT         NOT NULL DEFAULT 0,
    available_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ,
    PRIMARY KEY (event_id, consumer),
    CONSTRAINT domain_event_consumptions_status_check
        CHECK (status IN ('pending', 'retry', 'done', 'dlq'))
);

-- Worker claim scan: only rows that are actually runnable.
CREATE INDEX IF NOT EXISTS idx_domain_event_consumptions_due
    ON domain_event_consumptions (available_at ASC, event_pk ASC)
    WHERE status IN ('pending', 'retry');

-- Operator surface: "what is stuck / dead-lettered right now".
CREATE INDEX IF NOT EXISTS idx_domain_event_consumptions_dlq
    ON domain_event_consumptions (consumer, created_at DESC)
    WHERE status = 'dlq';

-- Retention sweep of settled rows.
CREATE INDEX IF NOT EXISTS idx_domain_event_consumptions_processed_at
    ON domain_event_consumptions (processed_at)
    WHERE status = 'done';

-- ── Notification outbox hardening (ED-005) ───────────────────────────────────
-- A permanently-failing row previously stayed eligible on every relay tick and
-- starved the batch, because MarkPublishError left published_at NULL with no
-- backoff. Give it the same attempts/backoff shape as domain_events.
ALTER TABLE notification_outbox
    ADD COLUMN IF NOT EXISTS publish_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE notification_outbox
    ADD COLUMN IF NOT EXISTS publish_after TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP INDEX IF EXISTS notification_outbox_unpublished_idx;
CREATE INDEX IF NOT EXISTS notification_outbox_unpublished_idx
    ON notification_outbox (publish_after ASC, id ASC)
    WHERE published_at IS NULL;

-- The delivery ledger claimed a key BEFORE the provider call, so a failed send
-- was never retried: the next attempt saw the row and skipped. Split the row
-- into claim (pending) and confirm (delivered) so a crash or provider error
-- releases the claim instead of swallowing the message.
ALTER TABLE notification_deliveries
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'delivered';
ALTER TABLE notification_deliveries
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE notification_deliveries
    ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE notification_deliveries
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Existing rows predate the split and were only ever written after a successful
-- send, so 'delivered' (the column default) is already correct for them.
ALTER TABLE notification_deliveries
    ADD CONSTRAINT notification_deliveries_status_check
    CHECK (status IN ('pending', 'delivered', 'failed'));

-- Retention sweeps need a time index; the table only had its PK.
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_delivered_at
    ON notification_deliveries (delivered_at);

-- +goose Down
DROP INDEX IF EXISTS idx_notification_deliveries_delivered_at;
ALTER TABLE notification_deliveries
    DROP CONSTRAINT IF EXISTS notification_deliveries_status_check;
ALTER TABLE notification_deliveries DROP COLUMN IF EXISTS claimed_at;
ALTER TABLE notification_deliveries DROP COLUMN IF EXISTS last_error;
ALTER TABLE notification_deliveries DROP COLUMN IF EXISTS attempts;
ALTER TABLE notification_deliveries DROP COLUMN IF EXISTS status;

DROP INDEX IF EXISTS notification_outbox_unpublished_idx;
CREATE INDEX IF NOT EXISTS notification_outbox_unpublished_idx
    ON notification_outbox (created_at ASC)
    WHERE published_at IS NULL;
ALTER TABLE notification_outbox DROP COLUMN IF EXISTS publish_after;
ALTER TABLE notification_outbox DROP COLUMN IF EXISTS publish_attempts;

DROP INDEX IF EXISTS uq_domain_events_event_id;
DROP TABLE IF EXISTS domain_event_consumptions;
DROP TABLE IF EXISTS domain_events;
