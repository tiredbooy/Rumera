-- +goose Up

CREATE TABLE search_summary (
    -- Dimensions
    date            DATE            NOT NULL,
    query_text      VARCHAR(300)    NOT NULL, -- the search term

    -- Volume
    search_count        INT         NOT NULL DEFAULT 0, -- how many times searched
    unique_users        INT         NOT NULL DEFAULT 0,
    unique_sessions     INT         NOT NULL DEFAULT 0,

    -- Results quality
    avg_results_count   NUMERIC(8,2)    NOT NULL DEFAULT 0,
    zero_results_count  INT             NOT NULL DEFAULT 0, -- searched but nothing found
    
    -- Engagement
    click_count         INT         NOT NULL DEFAULT 0, -- clicked a result
    click_through_rate  NUMERIC(5,4)    NOT NULL DEFAULT 0,
    
    -- Conversion
    cart_add_count      INT         NOT NULL DEFAULT 0, -- added to cart after this search
    purchase_count      INT         NOT NULL DEFAULT 0, -- bought after this search
    conversion_rate     NUMERIC(5,4)    NOT NULL DEFAULT 0,

    -- What they clicked (top 5 products clicked from this search)
    -- [{"product_id": "<catalog bigint as string>", "click_count": 12}]
    top_clicked_products    JSONB   NOT NULL DEFAULT '[]',

    -- Filters used with this search
    -- [{"filter": "category", "value": "whisky", "count": 8}]
    common_filters_used     JSONB   NOT NULL DEFAULT '[]',

    -- Meta
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (date, query_text)
);

SELECT create_hypertable('search_summary', 'date', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_ss_date_count         ON search_summary (date DESC, search_count DESC);
CREATE INDEX idx_ss_zero_results       ON search_summary (date DESC, zero_results_count DESC);
CREATE INDEX idx_ss_conversion         ON search_summary (date DESC, conversion_rate DESC);
CREATE INDEX idx_ss_query              ON search_summary (query_text, date DESC);

-- +goose Down
DROP TABLE search_summary;