-- +goose Up

-- A local hero file needs the stable slide ID before its owner-aware key can be
-- generated. Inactive rows may therefore exist briefly without desktop media;
-- activation still requires a real non-blank image URL.
ALTER TABLE hero_slides
    ALTER COLUMN image_url DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS hero_slides_active_image_required;

ALTER TABLE hero_slides
    ADD CONSTRAINT hero_slides_active_image_required CHECK (
        NOT is_active OR NULLIF(BTRIM(image_url), '') IS NOT NULL
    ) NOT VALID;

ALTER TABLE hero_slides
    VALIDATE CONSTRAINT hero_slides_active_image_required;

-- +goose Down

-- Older code cannot represent NULL desktop media. Preserve drafts as inactive
-- rows and use its historical empty-string representation before restoring the
-- original NOT NULL column contract.
UPDATE hero_slides
SET is_active = FALSE
WHERE image_url IS NULL OR BTRIM(image_url) = '';

UPDATE hero_slides
SET image_url = ''
WHERE image_url IS NULL;

ALTER TABLE hero_slides
    DROP CONSTRAINT IF EXISTS hero_slides_active_image_required,
    ALTER COLUMN image_url SET NOT NULL;
