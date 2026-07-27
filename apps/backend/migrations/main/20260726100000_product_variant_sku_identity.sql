-- +goose Up
-- SKUs are optional, but a supplied value is a trimmed, case-insensitive
-- catalogue identity. Normalize legacy blanks before replacing the original
-- case-sensitive UNIQUE constraint.
UPDATE product_variants
SET sku = NULLIF(BTRIM(sku), '');

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM product_variants
        WHERE sku IS NOT NULL
        GROUP BY LOWER(sku)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'product_variants contains duplicate case-insensitive SKUs';
    END IF;
END $$;
-- +goose StatementEnd

ALTER TABLE product_variants
    DROP CONSTRAINT product_variants_sku_key,
    ADD CONSTRAINT product_variants_sku_not_blank
        CHECK (sku IS NULL OR (sku = BTRIM(sku) AND sku <> ''));

CREATE UNIQUE INDEX product_variants_sku_ci_key
    ON product_variants (LOWER(sku))
    WHERE sku IS NOT NULL;

-- +goose Down
DROP INDEX product_variants_sku_ci_key;

ALTER TABLE product_variants
    DROP CONSTRAINT product_variants_sku_not_blank,
    ADD CONSTRAINT product_variants_sku_key UNIQUE (sku);
