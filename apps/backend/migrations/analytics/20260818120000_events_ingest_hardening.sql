-- +goose Up
-- A-8. `events` is the hottest write path in the system and carried six indexes.
-- Every one is write amplification on every ingest batch, so each has to be paid
-- for by a query that actually uses it. Two are not:
--
--   idx_events_payload  GIN (payload)
--     Nothing queries the payload with a jsonb containment/existence operator.
--     Every reader extracts a text key — `payload->>'product_id'`,
--     `payload->>'status'`, `payload->>'query'`, `payload->>'category_id'` — which
--     jsonb_ops GIN cannot serve. It is the most expensive index on the table and
--     the planner has never had a reason to open it. `payload ? 'product_id'` in
--     stats_job is an existence check on a row the scan already has.
--     (idx_events_product_id, the btree expression index, is what serves that job.)
--
--   idx_events_utm_source
--     utm_source is written by the capture middleware and selected back in the
--     admin event list. No query filters, joins or groups by it.
--
-- Kept, each with a live reader: idx_events_type_time (event_type filter in
-- EventRepository.List), idx_events_user_time (user filter + revenue_job's
-- GROUP BY user_id), idx_events_session (GetUserJourney, search_job's session
-- subquery), idx_events_country (country filter in List/CountByType),
-- idx_events_product_id (stats_job per-product aggregation).
--
-- Before dropping anything else, check it against real usage:
--   SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE relname = 'events';
DROP INDEX IF EXISTS idx_events_payload;
DROP INDEX IF EXISTS idx_events_utm_source;

-- Compression at 30 days existed; nothing ever dropped a chunk, so compressed
-- chunks accumulated forever. Dashboards read the pre-aggregated daily_* rollups,
-- not raw events, and the roll-up backfill window is 14 days — a year of raw
-- events is well past every reader.
SELECT add_retention_policy('events', INTERVAL '365 days', if_not_exists => TRUE);

-- +goose Down
SELECT remove_retention_policy('events', if_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_events_utm_source ON events (utm_source, created_at DESC) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_payload ON events USING GIN (payload);
