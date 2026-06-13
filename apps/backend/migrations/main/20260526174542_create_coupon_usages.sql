-- +goose Up
CREATE TABLE IF NOT EXISTS coupon_usages (
    id              BIGSERIAL PRIMARY KEY,
    coupon_id       BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- snapshot the actual discount applied at time of use (coupon value may change later)
    discount_applied NUMERIC(10, 2) NOT NULL CHECK (discount_applied >= 0),

    used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- one coupon per order, one order per usage row
    CONSTRAINT uq_coupon_order UNIQUE (coupon_id, order_id)
);

-- Fast lookups: "how many times has user X used coupon Y?"
CREATE INDEX idx_coupon_usages_coupon_id ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user_id   ON coupon_usages(user_id);
CREATE INDEX idx_coupon_usages_order_id  ON coupon_usages(order_id);

-- +goose Down
DROP TABLE IF EXISTS coupon_usages;
