-- +goose Up
CREATE TYPE discount_type AS ENUM (
    'percentage',      -- e.g. 20% off
    'fixed_amount',    -- e.g. $10 off
    'free_shipping'
);

CREATE TABLE IF NOT EXISTS coupons (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(64) NOT NULL UNIQUE,
    description     TEXT,
    discount_type   discount_type NOT NULL,

    -- for percentage: 0.00–100.00; for fixed_amount: dollar value; for free_shipping: ignored
    discount_value  NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),

    -- cap the max discount for percentage coupons (NULL = no cap)
    max_discount_amount NUMERIC(10, 2) CHECK (max_discount_amount > 0),

    -- minimum order subtotal required to use this coupon
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),

    -- NULL = unlimited uses
    max_uses        INT CHECK (max_uses > 0),
    -- NULL = unlimited per-user uses
    max_uses_per_user INT NOT NULL DEFAULT 1 CHECK (max_uses_per_user > 0),

    -- NULL = applies to everything
    applicable_to   JSONB,  -- e.g. {"category_ids": [1,2], "product_ids": [10,11]}

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ CHECK (expires_at > starts_at),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code      ON coupons(code);
CREATE INDEX idx_coupons_active    ON coupons(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_coupons_expires   ON coupons(expires_at);

CREATE TRIGGER trg_coupons_updated_at
BEFORE UPDATE ON coupons
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS coupons;
