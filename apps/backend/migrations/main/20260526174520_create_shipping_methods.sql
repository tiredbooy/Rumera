-- +goose Up
CREATE TYPE shipping_rate_type AS ENUM (
    'flat_rate',       -- fixed cost regardless of weight/price
    'per_kg',          -- price × weight in kg
    'percentage',      -- % of order subtotal
    'free'             -- always free
);

CREATE TABLE IF NOT EXISTS shipping_methods (
    id                  BIGSERIAL PRIMARY KEY,
    shipping_zone_id    BIGINT NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,

    name                VARCHAR(100) NOT NULL,   -- e.g. "Standard", "Express", "Overnight"
    carrier             VARCHAR(100),             -- e.g. "FedEx", "UPS", "DHL"
    description         TEXT,

    rate_type           shipping_rate_type NOT NULL DEFAULT 'flat_rate',
    base_rate           NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (base_rate >= 0),

    -- optional: free shipping above this order value (NULL = never auto-free)
    free_above_amount   NUMERIC(10, 2) CHECK (free_above_amount > 0),

    -- estimated delivery window in calendar days
    min_delivery_days   SMALLINT CHECK (min_delivery_days >= 0),
    max_delivery_days   SMALLINT CHECK (max_delivery_days >= min_delivery_days),

    -- weight/dimension constraints (NULL = no limit)
    max_weight_kg       NUMERIC(8, 2) CHECK (max_weight_kg > 0),

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_methods_zone   ON shipping_methods(shipping_zone_id);
CREATE INDEX idx_shipping_methods_active ON shipping_methods(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_shipping_methods_updated_at
BEFORE UPDATE ON shipping_methods
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS shipping_methods;
