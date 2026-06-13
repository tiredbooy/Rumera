-- +goose Up
CREATE TABLE IF NOT EXISTS shipping_zones (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,    -- e.g. "Continental US", "Europe", "Rest of World"
    description     TEXT,

    -- store country codes, state codes, or postal code prefixes
    -- e.g. ["US-CA", "US-NY"] or ["GB", "FR", "DE"]
    region_codes    TEXT[] NOT NULL DEFAULT '{}',

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_zones_active ON shipping_zones(is_active) WHERE is_active = TRUE;
-- GIN index for fast array containment queries: WHERE 'US' = ANY(region_codes)
CREATE INDEX idx_shipping_zones_regions ON shipping_zones USING GIN(region_codes);

CREATE TRIGGER trg_shipping_zones_updated_at
BEFORE UPDATE ON shipping_zones
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS shipping_zones;
