-- +goose NO TRANSACTION
-- PH-030a: Persian-aware search normalize + optional pg_trgm indexes.
-- Go pkg/searchtext.Normalize must stay lockstep with rumera_search_normalize.

-- +goose Up

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Immutable normalizer used by product free-text ILIKE (title/description/brand/category).
-- Rules: Arabic ك/ي/ى → Persian ک/ی; strip ZWNJ/ZWJ; lower; strip whitespace.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION rumera_search_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    lower(
      replace(
        replace(
          translate(
            coalesce(input, ''),
            E'\u0643\u064A\u0649',
            E'\u06A9\u06CC\u06CC'
          ),
          E'\u200c',
          ''
        ),
        E'\u200d',
        ''
      )
    ),
    '[[:space:]]+',
    '',
    'g'
  );
$$;
-- +goose StatementEnd

COMMENT ON FUNCTION rumera_search_normalize(text) IS
  'PH-030a Persian-aware search normalize; lockstep with pkg/searchtext.Normalize';

-- Trigram indexes accelerate ILIKE '%…%' on normalized titles (safe, optional quality).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_title_search_trgm
  ON products USING gin (rumera_search_normalize(title) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brands_title_search_trgm
  ON brands USING gin (rumera_search_normalize(title) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_title_search_trgm
  ON categories USING gin (rumera_search_normalize(title) gin_trgm_ops);

-- +goose Down

DROP INDEX CONCURRENTLY IF EXISTS idx_categories_title_search_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_brands_title_search_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_title_search_trgm;
DROP FUNCTION IF EXISTS rumera_search_normalize(text);
-- Leave pg_trgm installed (may be shared); no DROP EXTENSION.
