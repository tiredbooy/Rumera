-- +goose Up

CREATE TABLE daily_revenue_stats (
    -- Dimensions
    date                DATE            NOT NULL,

    -- Order volume
    orders_total            INT         NOT NULL DEFAULT 0,
    orders_completed        INT         NOT NULL DEFAULT 0,
    orders_cancelled        INT         NOT NULL DEFAULT 0,
    orders_refunded         INT         NOT NULL DEFAULT 0,

    -- Revenue
    gross_revenue           NUMERIC(14,2)   NOT NULL DEFAULT 0,
    refunds_total           NUMERIC(14,2)   NOT NULL DEFAULT 0,
    discounts_total         NUMERIC(14,2)   NOT NULL DEFAULT 0,
    net_revenue             NUMERIC(14,2)   NOT NULL DEFAULT 0, -- gross - refunds - discounts
    shipping_revenue        NUMERIC(14,2)   NOT NULL DEFAULT 0,

    -- Average order value
    avg_order_value         NUMERIC(10,2)   NOT NULL DEFAULT 0,

    -- Payment method breakdown
    revenue_crypto          NUMERIC(14,2)   NOT NULL DEFAULT 0,
    revenue_wallet          NUMERIC(14,2)   NOT NULL DEFAULT 0,
    revenue_other           NUMERIC(14,2)   NOT NULL DEFAULT 0,

    -- Customer breakdown
    orders_new_customers    INT         NOT NULL DEFAULT 0, -- first order ever
    orders_returning        INT         NOT NULL DEFAULT 0,
    unique_customers        INT         NOT NULL DEFAULT 0,

    -- Coupon usage
    coupon_uses             INT         NOT NULL DEFAULT 0,
    coupon_discount_total   NUMERIC(12,2)   NOT NULL DEFAULT 0,

    -- Cart metrics
    carts_created           INT         NOT NULL DEFAULT 0,
    carts_abandoned         INT         NOT NULL DEFAULT 0,
    cart_abandonment_rate   NUMERIC(5,4)    NOT NULL DEFAULT 0,
    cart_recovery_count     INT         NOT NULL DEFAULT 0,

    -- Traffic
    sessions_total          INT         NOT NULL DEFAULT 0,
    sessions_new            INT         NOT NULL DEFAULT 0,
    sessions_returning      INT         NOT NULL DEFAULT 0,
    conversion_rate         NUMERIC(5,4)    NOT NULL DEFAULT 0, -- sessions that bought

    -- Top categories (stored as JSONB array for flexibility)
    -- e.g. [{"category_id": "uuid", "revenue": 1200.00, "units": 45}]
    top_categories          JSONB           NOT NULL DEFAULT '[]',
    top_products            JSONB           NOT NULL DEFAULT '[]', -- top 10 by revenue

    -- Meta
    computed_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (date)
);

SELECT create_hypertable('daily_revenue_stats', 'date', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_drs_date          ON daily_revenue_stats (date DESC);
CREATE INDEX idx_drs_net_revenue   ON daily_revenue_stats (date DESC, net_revenue DESC);

-- +goose Down
DROP TABLE daily_revenue_stats;