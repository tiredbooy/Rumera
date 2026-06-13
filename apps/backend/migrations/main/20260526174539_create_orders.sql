-- +goose Up
CREATE TYPE order_status AS ENUM (
    'pending',          -- created, awaiting payment
    'payment_failed',   -- payment attempted but failed
    'paid',             -- payment confirmed
    'processing',       -- warehouse picking/packing
    'ready_to_ship',    -- packed, awaiting carrier pickup
    'shipped',          -- in transit with carrier
    'out_for_delivery', -- last-mile delivery
    'delivered',        -- confirmed received
    'refund_requested', -- customer initiated refund
    'refund_approved',  -- refund authorized
    'refunded',         -- money returned to customer
    'partially_refunded',
    'cancelled'
);

CREATE TYPE payment_method AS ENUM (
    'card',
    'crypto',
    'bank_transfer',
    'wallet',          -- e.g. Apple Pay, Google Pay
    'gateway'          -- generic third-party gateway
);

CREATE TABLE IF NOT EXISTS orders (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    address_id      BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    status          order_status NOT NULL DEFAULT 'pending',
    payment_method  payment_method NOT NULL,

    subtotal        NUMERIC(20, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    shipping_cost   NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    tax_amount      NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount    NUMERIC(20, 2) NOT NULL GENERATED ALWAYS AS
                        (subtotal - discount_amount + shipping_cost + tax_amount) STORED,

    coupon_id       BIGINT REFERENCES coupons(id) ON DELETE SET NULL,
    shipping_method_id BIGINT REFERENCES shipping_methods(id) ON DELETE SET NULL,

    notes           TEXT,
    paid_at         TIMESTAMPTZ,          -- NULL until actually paid
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id   ON orders(user_id);
CREATE INDEX idx_orders_status    ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS orders;
