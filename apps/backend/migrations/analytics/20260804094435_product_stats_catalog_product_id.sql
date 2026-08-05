-- +goose Up
-- Align daily product stats with catalog BIGINT product IDs.
-- Aggregate rows are rebuildable from events; drop and recreate with the
-- canonical catalog key type instead of the prior analytics UUID.

DROP TABLE IF EXISTS daily_product_stats CASCADE;

CREATE TABLE daily_product_stats (
    date            DATE            NOT NULL,
    product_id      BIGINT          NOT NULL,

    views_total         INT         NOT NULL DEFAULT 0,
    views_unique        INT         NOT NULL DEFAULT 0,
    views_registered    INT         NOT NULL DEFAULT 0,
    views_guest         INT         NOT NULL DEFAULT 0,

    avg_view_duration_sec   NUMERIC(8,2)    NOT NULL DEFAULT 0,
    image_views_total       INT             NOT NULL DEFAULT 0,
    variant_selections      INT             NOT NULL DEFAULT 0,

    add_to_cart_count       INT             NOT NULL DEFAULT 0,
    add_to_wishlist_count   INT             NOT NULL DEFAULT 0,
    checkout_started_count  INT             NOT NULL DEFAULT 0,
    purchase_count          INT             NOT NULL DEFAULT 0,
    units_sold              INT             NOT NULL DEFAULT 0,

    revenue_total           NUMERIC(12,2)   NOT NULL DEFAULT 0,

    view_to_cart_rate       NUMERIC(5,4)    NOT NULL DEFAULT 0,
    cart_to_purchase_rate   NUMERIC(5,4)    NOT NULL DEFAULT 0,

    source_search           INT             NOT NULL DEFAULT 0,
    source_category         INT             NOT NULL DEFAULT 0,
    source_recommendation   INT             NOT NULL DEFAULT 0,
    source_direct           INT             NOT NULL DEFAULT 0,
    source_blog             INT             NOT NULL DEFAULT 0,
    source_recipe           INT             NOT NULL DEFAULT 0,

    device_mobile           INT             NOT NULL DEFAULT 0,
    device_desktop          INT             NOT NULL DEFAULT 0,
    device_tablet           INT             NOT NULL DEFAULT 0,

    return_count            INT             NOT NULL DEFAULT 0,
    review_count            INT             NOT NULL DEFAULT 0,
    avg_rating              NUMERIC(3,2)    NULL,

    computed_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (date, product_id)
);

SELECT create_hypertable('daily_product_stats', 'date', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_dps_product_date  ON daily_product_stats (product_id, date DESC);
CREATE INDEX idx_dps_revenue       ON daily_product_stats (date DESC, revenue_total DESC);
CREATE INDEX idx_dps_views         ON daily_product_stats (date DESC, views_total DESC);
CREATE INDEX idx_dps_conversion    ON daily_product_stats (date DESC, view_to_cart_rate DESC);

-- +goose Down
DROP TABLE IF EXISTS daily_product_stats CASCADE;

CREATE TABLE daily_product_stats (
    date            DATE            NOT NULL,
    product_id      UUID            NOT NULL,

    views_total         INT         NOT NULL DEFAULT 0,
    views_unique        INT         NOT NULL DEFAULT 0,
    views_registered    INT         NOT NULL DEFAULT 0,
    views_guest         INT         NOT NULL DEFAULT 0,

    avg_view_duration_sec   NUMERIC(8,2)    NOT NULL DEFAULT 0,
    image_views_total       INT             NOT NULL DEFAULT 0,
    variant_selections      INT             NOT NULL DEFAULT 0,

    add_to_cart_count       INT             NOT NULL DEFAULT 0,
    add_to_wishlist_count   INT             NOT NULL DEFAULT 0,
    checkout_started_count  INT             NOT NULL DEFAULT 0,
    purchase_count          INT             NOT NULL DEFAULT 0,
    units_sold              INT             NOT NULL DEFAULT 0,

    revenue_total           NUMERIC(12,2)   NOT NULL DEFAULT 0,

    view_to_cart_rate       NUMERIC(5,4)    NOT NULL DEFAULT 0,
    cart_to_purchase_rate   NUMERIC(5,4)    NOT NULL DEFAULT 0,

    source_search           INT             NOT NULL DEFAULT 0,
    source_category         INT             NOT NULL DEFAULT 0,
    source_recommendation   INT             NOT NULL DEFAULT 0,
    source_direct           INT             NOT NULL DEFAULT 0,
    source_blog             INT             NOT NULL DEFAULT 0,
    source_recipe           INT             NOT NULL DEFAULT 0,

    device_mobile           INT             NOT NULL DEFAULT 0,
    device_desktop          INT             NOT NULL DEFAULT 0,
    device_tablet           INT             NOT NULL DEFAULT 0,

    return_count            INT             NOT NULL DEFAULT 0,
    review_count            INT             NOT NULL DEFAULT 0,
    avg_rating              NUMERIC(3,2)    NULL,

    computed_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (date, product_id)
);

SELECT create_hypertable('daily_product_stats', 'date', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_dps_product_date  ON daily_product_stats (product_id, date DESC);
CREATE INDEX idx_dps_revenue       ON daily_product_stats (date DESC, revenue_total DESC);
CREATE INDEX idx_dps_views         ON daily_product_stats (date DESC, views_total DESC);
CREATE INDEX idx_dps_conversion    ON daily_product_stats (date DESC, view_to_cart_rate DESC);
