-- +goose Up
-- Uploaded images are now stored locally and served through the on-the-fly
-- transform endpoint (GET /media/{storage_key}). storage_key is the backend key
-- for the original; image_url keeps holding the canonical serving URL
-- (/media/{key} for uploads, or an external URL for legacy/seed rows).
-- width/height are the original pixel dimensions, captured at upload so the
-- frontend can reserve space and avoid layout shift.
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS height INTEGER;

COMMENT ON COLUMN product_images.storage_key IS 'Storage backend key for the original upload; NULL for externally-hosted image_url rows.';

-- +goose Down
ALTER TABLE product_images DROP COLUMN IF EXISTS height;
ALTER TABLE product_images DROP COLUMN IF EXISTS width;
ALTER TABLE product_images DROP COLUMN IF EXISTS storage_key;
