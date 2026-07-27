-- +goose Up
-- Normalize legacy labels before making the option catalogue authoritative.
UPDATE option_types
SET
    title = COALESCE(NULLIF(BTRIM(title), ''), NULLIF(BTRIM(display_name), '')),
    display_name = COALESCE(NULLIF(BTRIM(display_name), ''), NULLIF(BTRIM(title), ''));

UPDATE option_values
SET
    value = BTRIM(value),
    sort_order = GREATEST(sort_order, 0);

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM option_types
        WHERE title IS NULL OR display_name IS NULL OR title = '' OR display_name = ''
    ) THEN
        RAISE EXCEPTION 'option_types contains rows without a usable title/display_name';
    END IF;
    IF EXISTS (SELECT 1 FROM option_values WHERE variant_id IS NULL OR value = '') THEN
        RAISE EXCEPTION 'option_values contains rows without an option type or value';
    END IF;
    IF EXISTS (
        SELECT 1 FROM option_types GROUP BY LOWER(title) HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'option_types contains duplicate case-insensitive titles';
    END IF;
    IF EXISTS (
        SELECT 1 FROM option_values
        GROUP BY variant_id, LOWER(value)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'option_values contains duplicate values within an option type';
    END IF;
END $$;
-- +goose StatementEnd

ALTER TABLE option_types
    ALTER COLUMN title SET NOT NULL,
    ALTER COLUMN display_name SET NOT NULL,
    ADD CONSTRAINT option_types_title_not_blank CHECK (title = BTRIM(title) AND title <> ''),
    ADD CONSTRAINT option_types_display_name_not_blank CHECK (display_name = BTRIM(display_name) AND display_name <> '');

CREATE UNIQUE INDEX option_types_title_ci_key
    ON option_types (LOWER(title));

ALTER TABLE option_values
    DROP CONSTRAINT option_values_variant_id_fkey;

ALTER TABLE option_values
    RENAME COLUMN variant_id TO option_type_id;

ALTER TABLE option_values
    ALTER COLUMN option_type_id SET NOT NULL,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD CONSTRAINT option_values_value_not_blank CHECK (value = BTRIM(value) AND value <> ''),
    ADD CONSTRAINT option_values_sort_order_nonnegative CHECK (sort_order >= 0),
    ADD CONSTRAINT option_values_option_type_id_fkey
        FOREIGN KEY (option_type_id) REFERENCES option_types(id) ON DELETE RESTRICT,
    ADD CONSTRAINT option_values_id_option_type_key UNIQUE (id, option_type_id);

CREATE UNIQUE INDEX option_values_type_value_ci_key
    ON option_values (option_type_id, LOWER(value));

CREATE TRIGGER trg_option_values_updated_at
BEFORE UPDATE ON option_values
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE product_variants_options
    DROP CONSTRAINT product_variants_options_product_variant_id_key,
    DROP CONSTRAINT product_variants_options_variant_option_id_key,
    DROP CONSTRAINT product_variants_options_variant_option_id_fkey,
    ADD COLUMN option_type_id BIGINT;

UPDATE product_variants_options pvo
SET option_type_id = ov.option_type_id
FROM option_values ov
WHERE ov.id = pvo.variant_option_id;

ALTER TABLE product_variants_options
    ALTER COLUMN option_type_id SET NOT NULL,
    ADD CONSTRAINT product_variants_options_option_value_type_fkey
        FOREIGN KEY (variant_option_id, option_type_id)
        REFERENCES option_values(id, option_type_id) ON DELETE RESTRICT,
    ADD CONSTRAINT product_variants_options_variant_value_key
        UNIQUE (product_variant_id, variant_option_id),
    ADD CONSTRAINT product_variants_options_variant_type_key
        UNIQUE (product_variant_id, option_type_id);

CREATE INDEX idx_product_variants_options_value_type
    ON product_variants_options (variant_option_id, option_type_id);

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM product_variants_options
        GROUP BY product_variant_id HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM product_variants_options
        GROUP BY variant_option_id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'cannot restore legacy one-option/one-variant constraints while reusable combinations exist';
    END IF;
END $$;
-- +goose StatementEnd

DROP INDEX idx_product_variants_options_value_type;

ALTER TABLE product_variants_options
    DROP CONSTRAINT product_variants_options_option_value_type_fkey,
    DROP CONSTRAINT product_variants_options_variant_value_key,
    DROP CONSTRAINT product_variants_options_variant_type_key,
    DROP COLUMN option_type_id,
    ADD CONSTRAINT product_variants_options_variant_option_id_fkey
        FOREIGN KEY (variant_option_id) REFERENCES option_values(id) ON DELETE CASCADE,
    ADD CONSTRAINT product_variants_options_product_variant_id_key UNIQUE (product_variant_id),
    ADD CONSTRAINT product_variants_options_variant_option_id_key UNIQUE (variant_option_id);

DROP TRIGGER trg_option_values_updated_at ON option_values;
DROP INDEX option_values_type_value_ci_key;

ALTER TABLE option_values
    DROP CONSTRAINT option_values_id_option_type_key,
    DROP CONSTRAINT option_values_option_type_id_fkey,
    DROP CONSTRAINT option_values_value_not_blank,
    DROP CONSTRAINT option_values_sort_order_nonnegative,
    DROP COLUMN updated_at;

ALTER TABLE option_values
    RENAME COLUMN option_type_id TO variant_id;

ALTER TABLE option_values
    ALTER COLUMN variant_id DROP NOT NULL,
    ADD CONSTRAINT option_values_variant_id_fkey
        FOREIGN KEY (variant_id) REFERENCES option_types(id) ON DELETE CASCADE;

DROP INDEX option_types_title_ci_key;

ALTER TABLE option_types
    DROP CONSTRAINT option_types_title_not_blank,
    DROP CONSTRAINT option_types_display_name_not_blank,
    ALTER COLUMN title DROP NOT NULL,
    ALTER COLUMN display_name DROP NOT NULL;
