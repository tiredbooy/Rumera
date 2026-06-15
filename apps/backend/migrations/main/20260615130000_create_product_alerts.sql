-- +goose Up
-- Back-in-stock and price-drop alerts a customer subscribes to on a product
-- variant. A background job scans for satisfied alerts, emails the customer, and
-- stamps notified_at so each alert fires once.
CREATE TABLE IF NOT EXISTS product_alerts (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    alert_type         VARCHAR(20) NOT NULL CHECK (alert_type IN ('restock', 'price_drop')),
    -- price_drop: notify when current price falls below COALESCE(target_price, reference_price).
    target_price       NUMERIC(20, 2),
    reference_price    NUMERIC(20, 2) NOT NULL DEFAULT 0,
    notified_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One live alert of each type per customer per variant.
    UNIQUE (user_id, product_variant_id, alert_type)
);

-- The checker only ever scans un-notified rows.
CREATE INDEX IF NOT EXISTS idx_product_alerts_pending
    ON product_alerts (product_variant_id)
    WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_alerts_user ON product_alerts (user_id);

-- +goose Down
DROP TABLE IF EXISTS product_alerts;
