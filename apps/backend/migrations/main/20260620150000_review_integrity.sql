-- +goose Up
-- Keep the newest active review if historical races produced duplicates, then
-- enforce the one-active-review-per-user/product invariant in the database.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, product_id
               ORDER BY created_at DESC, id DESC
           ) AS position
    FROM reviews
    WHERE deleted_at IS NULL
)
UPDATE reviews r
SET deleted_at = NOW()
FROM ranked
WHERE r.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_user_product_active
    ON reviews (user_id, product_id)
    WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS uq_reviews_user_product_active;
