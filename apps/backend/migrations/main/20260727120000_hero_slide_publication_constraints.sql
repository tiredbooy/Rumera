-- +goose Up

-- Keep the migration strict and atomic: deployments with inconsistent editorial
-- data must repair it explicitly rather than having schema changes rewrite copy.
ALTER TABLE hero_slides
    ADD CONSTRAINT hero_slides_schedule_ordered CHECK (
        starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at
    ),
    ADD CONSTRAINT hero_slides_primary_cta_complete CHECK (
        (NULLIF(BTRIM(cta_label), '') IS NULL)
        = (NULLIF(BTRIM(cta_href), '') IS NULL)
    ),
    ADD CONSTRAINT hero_slides_secondary_cta_complete CHECK (
        (NULLIF(BTRIM(secondary_cta_label), '') IS NULL)
        = (NULLIF(BTRIM(secondary_cta_href), '') IS NULL)
    ),
    ADD CONSTRAINT hero_slides_primary_cta_safe CHECK (
        NULLIF(BTRIM(cta_href), '') IS NULL OR (
            POSITION(CHR(92) IN BTRIM(cta_href)) = 0
            AND BTRIM(cta_href) !~ '[[:cntrl:]]'
            AND BTRIM(cta_href) !~* '%(0[0-9a-f]|1[0-9a-f]|7f|5c)'
            AND (
                BTRIM(cta_href) = '/'
                OR (
                    LEFT(BTRIM(cta_href), 1) = '/'
                    AND LEFT(BTRIM(cta_href), 2) <> '//'
                    AND BTRIM(cta_href) !~* '^/%2f'
                )
                OR BTRIM(cta_href) ~* '^https://[^/@?#[:space:]]+([/?#].*)?$'
            )
        )
    ),
    ADD CONSTRAINT hero_slides_secondary_cta_safe CHECK (
        NULLIF(BTRIM(secondary_cta_href), '') IS NULL OR (
            POSITION(CHR(92) IN BTRIM(secondary_cta_href)) = 0
            AND BTRIM(secondary_cta_href) !~ '[[:cntrl:]]'
            AND BTRIM(secondary_cta_href) !~* '%(0[0-9a-f]|1[0-9a-f]|7f|5c)'
            AND (
                BTRIM(secondary_cta_href) = '/'
                OR (
                    LEFT(BTRIM(secondary_cta_href), 1) = '/'
                    AND LEFT(BTRIM(secondary_cta_href), 2) <> '//'
                    AND BTRIM(secondary_cta_href) !~* '^/%2f'
                )
                OR BTRIM(secondary_cta_href) ~* '^https://[^/@?#[:space:]]+([/?#].*)?$'
            )
        )
    );

-- +goose Down

ALTER TABLE hero_slides
    DROP CONSTRAINT IF EXISTS hero_slides_secondary_cta_safe,
    DROP CONSTRAINT IF EXISTS hero_slides_primary_cta_safe,
    DROP CONSTRAINT IF EXISTS hero_slides_secondary_cta_complete,
    DROP CONSTRAINT IF EXISTS hero_slides_primary_cta_complete,
    DROP CONSTRAINT IF EXISTS hero_slides_schedule_ordered;
