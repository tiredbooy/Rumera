-- +goose Up
-- The daily product-stats roll-up (internal/corn/stats_job.go) filters events by
-- `payload->>'product_id' = $1` once per active product. Neither the GIN(payload)
-- index nor (event_type, created_at) serves an equality on the extracted text key,
-- so each call falls back to a chunk scan. This btree expression index matches the
-- predicate directly.
CREATE INDEX IF NOT EXISTS idx_events_product_id
    ON events ((payload->>'product_id'));

-- +goose Down
DROP INDEX IF EXISTS idx_events_product_id;
