-- +goose Up

CREATE TABLE daily_product_stats (
    -- Dimensions (what this row describes)
    date            DATE            NOT NULL,
    product_id      UUID            NOT NULL,

    -- View metrics
    views_total         INT         NOT NULL DEFAULT 0, -- total views that day
    views_unique        INT         NOT NULL DEFAULT 0, -- unique sessions
    views_registered    INT         NOT NULL DEFAULT 0, -- logged-in users only
    views_guest         INT         NOT NULL DEFAULT 0, -- guests only

    -- Engagement
    avg_view_duration_sec   NUMERIC(8,2)    NOT NULL DEFAULT 0,
    image_views_total       INT             NOT NULL DEFAULT 0,
    variant_selections      INT             NOT NULL DEFAULT 0, -- times a variant was picked

    -- Funnel
    add_to_cart_count       INT             NOT NULL DEFAULT 0,
    add_to_wishlist_count   INT             NOT NULL DEFAULT 0,
    checkout_started_count  INT             NOT NULL DEFAULT 0,
    purchase_count          INT             NOT NULL DEFAULT 0,
    units_sold              INT             NOT NULL DEFAULT 0,

    -- Revenue
    revenue_total           NUMERIC(12,2)   NOT NULL DEFAULT 0,

    -- Conversion rates (computed on insert by cron)
    view_to_cart_rate       NUMERIC(5,4)    NOT NULL DEFAULT 0, -- 0.0000 to 1.0000
    cart_to_purchase_rate   NUMERIC(5,4)    NOT NULL DEFAULT 0,

    -- Source breakdown (where did viewers come from)
    source_search           INT             NOT NULL DEFAULT 0,
    source_category         INT             NOT NULL DEFAULT 0,
    source_recommendation   INT             NOT NULL DEFAULT 0,
    source_direct           INT             NOT NULL DEFAULT 0,
    source_blog             INT             NOT NULL DEFAULT 0,
    source_recipe           INT             NOT NULL DEFAULT 0,

    -- Device breakdown
    device_mobile           INT             NOT NULL DEFAULT 0,
    device_desktop          INT             NOT NULL DEFAULT 0,
    device_tablet           INT             NOT NULL DEFAULT 0,

    -- Returns & issues
    return_count            INT             NOT NULL DEFAULT 0,
    review_count            INT             NOT NULL DEFAULT 0,
    avg_rating              NUMERIC(3,2)    NULL,

    -- Meta
    computed_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (date, product_id)
);

SELECT create_hypertable('daily_product_stats', 'date', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_dps_product_date  ON daily_product_stats (product_id, date DESC);
CREATE INDEX idx_dps_revenue       ON daily_product_stats (date DESC, revenue_total DESC);
CREATE INDEX idx_dps_views         ON daily_product_stats (date DESC, views_total DESC);
CREATE INDEX idx_dps_conversion    ON daily_product_stats (date DESC, view_to_cart_rate DESC);

-- +goose Down
DROP TABLE daily_product_stats;