-- +goose Up
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE events (
    -- Identity
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Who
    user_id         UUID            NULL,     -- NULL means guest
    session_id      UUID            NOT NULL, -- always present, set via cookie
    device_id       UUID            NULL,     -- persistent fingerprint across sessions

    -- What
    event_type      VARCHAR(60)     NOT NULL, -- e.g. "product_viewed"
    payload         JSONB           NOT NULL  DEFAULT '{}',

    -- Where in the app
    page_url        TEXT            NULL,
    page_referrer   TEXT            NULL,

    -- Device
    device_type     VARCHAR(20)     NULL      CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'unknown')),
    os              VARCHAR(40)     NULL,
    browser         VARCHAR(40)     NULL,
    screen_size     VARCHAR(20)     NULL,     -- e.g. "1920x1080"
    app_version     VARCHAR(20)     NULL,     -- your backend/app version at time of event

    -- Location (resolved from IP, never store raw IP for GDPR)
    country         CHAR(2)         NULL,     -- ISO 3166-1 alpha-2 e.g. "IR", "GB"
    city            VARCHAR(100)    NULL,
    timezone        VARCHAR(60)     NULL,     -- e.g. "Asia/Tehran"

    -- Marketing attribution
    utm_source      VARCHAR(120)    NULL,
    utm_medium      VARCHAR(120)    NULL,
    utm_campaign    VARCHAR(120)    NULL,
    utm_content     VARCHAR(120)    NULL,
    utm_term        VARCHAR(120)    NULL,

    -- When
    created_at      TIMESTAMPTZ     NOT NULL  DEFAULT NOW()
);

-- Convert to hypertable partitioned by time (TimescaleDB core feature)
-- chunk_time_interval: each chunk = 1 week of data
SELECT create_hypertable('events', 'created_at', chunk_time_interval => INTERVAL '1 week');

-- Enable compression on chunks older than 30 days (saves ~90% storage)
ALTER TABLE events SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'created_at DESC',
    timescaledb.compress_segmentby = 'event_type'
);
SELECT add_compression_policy('events', INTERVAL '30 days');

-- Indexes
CREATE INDEX idx_events_type_time       ON events (event_type, created_at DESC);
CREATE INDEX idx_events_user_time       ON events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_events_session         ON events (session_id, created_at DESC);
CREATE INDEX idx_events_payload         ON events USING GIN (payload);
CREATE INDEX idx_events_country         ON events (country, created_at DESC);
CREATE INDEX idx_events_utm_source      ON events (utm_source, created_at DESC) WHERE utm_source IS NOT NULL;

-- +goose Down
SELECT remove_compression_policy('events');
DROP TABLE events;