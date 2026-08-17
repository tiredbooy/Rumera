-- +goose Up
-- PR-004a: cartRepository.GetOrCreate uses INSERT … ON CONFLICT (user_id).
-- carts.user_id was only a non-unique index (20260526174414_create_carts.sql),
-- so Postgres rejected the conflict target and add-to-cart / GET /cart 500'd.
-- One cart per authenticated user. Guests stay unsupported (NOT NULL).

-- Keep one cart per user_id: prefer a cart that already has items, then newest.
-- Extra carts: merge their lines onto the keeper (sum qty on the same variant),
-- then delete the extras. Empty extras are deleted as-is.
-- Guest (NULL user_id) carts are dropped so the column can be NOT NULL.

WITH ranked AS (
    SELECT c.id,
           c.user_id,
           ROW_NUMBER() OVER (
               PARTITION BY c.user_id
               ORDER BY EXISTS (
                   SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id
               ) DESC,
               c.updated_at DESC NULLS LAST,
               c.id DESC
           ) AS rn
    FROM carts c
    WHERE c.user_id IS NOT NULL
),
keepers AS (
    SELECT id AS keep_id, user_id FROM ranked WHERE rn = 1
),
extras AS (
    SELECT r.id AS extra_id, k.keep_id
    FROM ranked r
    JOIN keepers k ON k.user_id = r.user_id
    WHERE r.rn > 1
),
extra_qty AS (
    SELECT e.keep_id,
           ci.product_variant_id,
           SUM(ci.quantity)::integer AS qty
    FROM cart_items ci
    JOIN extras e ON e.extra_id = ci.cart_id
    GROUP BY e.keep_id, ci.product_variant_id
)
UPDATE cart_items keeper
SET quantity = keeper.quantity + extra_qty.qty,
    updated_at = NOW()
FROM extra_qty
WHERE keeper.cart_id = extra_qty.keep_id
  AND keeper.product_variant_id = extra_qty.product_variant_id;

WITH ranked AS (
    SELECT c.id,
           c.user_id,
           ROW_NUMBER() OVER (
               PARTITION BY c.user_id
               ORDER BY EXISTS (
                   SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id
               ) DESC,
               c.updated_at DESC NULLS LAST,
               c.id DESC
           ) AS rn
    FROM carts c
    WHERE c.user_id IS NOT NULL
),
keepers AS (
    SELECT id AS keep_id, user_id FROM ranked WHERE rn = 1
),
extras AS (
    SELECT r.id AS extra_id, k.keep_id
    FROM ranked r
    JOIN keepers k ON k.user_id = r.user_id
    WHERE r.rn > 1
)
DELETE FROM cart_items extra
USING extras e, cart_items keeper
WHERE extra.cart_id = e.extra_id
  AND keeper.cart_id = e.keep_id
  AND keeper.product_variant_id = extra.product_variant_id;

-- Remaining extra lines are variants the keeper did not have. Collapse
-- same-variant lines from multiple extras onto one row before reassigning
-- so uq_cart_items_cart_variant is not violated.
WITH ranked AS (
    SELECT c.id,
           c.user_id,
           ROW_NUMBER() OVER (
               PARTITION BY c.user_id
               ORDER BY EXISTS (
                   SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id
               ) DESC,
               c.updated_at DESC NULLS LAST,
               c.id DESC
           ) AS rn
    FROM carts c
    WHERE c.user_id IS NOT NULL
),
keepers AS (
    SELECT id AS keep_id, user_id FROM ranked WHERE rn = 1
),
extras AS (
    SELECT r.id AS extra_id, k.keep_id
    FROM ranked r
    JOIN keepers k ON k.user_id = r.user_id
    WHERE r.rn > 1
),
extra_lines AS (
    SELECT ci.id,
           SUM(ci.quantity) OVER (
               PARTITION BY e.keep_id, ci.product_variant_id
           )::integer AS total_qty,
           ROW_NUMBER() OVER (
               PARTITION BY e.keep_id, ci.product_variant_id
               ORDER BY ci.id
           ) AS rn
    FROM cart_items ci
    JOIN extras e ON e.extra_id = ci.cart_id
)
UPDATE cart_items ci
SET quantity = extra_lines.total_qty,
    updated_at = NOW()
FROM extra_lines
WHERE ci.id = extra_lines.id
  AND extra_lines.rn = 1;

WITH ranked AS (
    SELECT c.id,
           c.user_id,
           ROW_NUMBER() OVER (
               PARTITION BY c.user_id
               ORDER BY EXISTS (
                   SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id
               ) DESC,
               c.updated_at DESC NULLS LAST,
               c.id DESC
           ) AS rn
    FROM carts c
    WHERE c.user_id IS NOT NULL
),
keepers AS (
    SELECT id AS keep_id, user_id FROM ranked WHERE rn = 1
),
extras AS (
    SELECT r.id AS extra_id, k.keep_id
    FROM ranked r
    JOIN keepers k ON k.user_id = r.user_id
    WHERE r.rn > 1
),
extra_lines AS (
    SELECT ci.id,
           ROW_NUMBER() OVER (
               PARTITION BY e.keep_id, ci.product_variant_id
               ORDER BY ci.id
           ) AS rn
    FROM cart_items ci
    JOIN extras e ON e.extra_id = ci.cart_id
)
DELETE FROM cart_items ci
USING extra_lines
WHERE ci.id = extra_lines.id
  AND extra_lines.rn > 1;

WITH ranked AS (
    SELECT c.id,
           c.user_id,
           ROW_NUMBER() OVER (
               PARTITION BY c.user_id
               ORDER BY EXISTS (
                   SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id
               ) DESC,
               c.updated_at DESC NULLS LAST,
               c.id DESC
           ) AS rn
    FROM carts c
    WHERE c.user_id IS NOT NULL
),
keepers AS (
    SELECT id AS keep_id, user_id FROM ranked WHERE rn = 1
),
extras AS (
    SELECT r.id AS extra_id, k.keep_id
    FROM ranked r
    JOIN keepers k ON k.user_id = r.user_id
    WHERE r.rn > 1
)
UPDATE cart_items ci
SET cart_id = e.keep_id,
    updated_at = NOW()
FROM extras e
WHERE ci.cart_id = e.extra_id;

WITH ranked AS (
    SELECT c.id,
           c.user_id,
           ROW_NUMBER() OVER (
               PARTITION BY c.user_id
               ORDER BY EXISTS (
                   SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id
               ) DESC,
               c.updated_at DESC NULLS LAST,
               c.id DESC
           ) AS rn
    FROM carts c
    WHERE c.user_id IS NOT NULL
),
extras AS (
    SELECT r.id AS extra_id
    FROM ranked r
    WHERE r.rn > 1
)
DELETE FROM carts c
USING extras e
WHERE c.id = e.extra_id;

-- Guest carts were never a product surface; drop leftovers so user_id
-- can be NOT NULL. cart_items has no ON DELETE CASCADE.
DELETE FROM cart_items
WHERE cart_id IN (SELECT id FROM carts WHERE user_id IS NULL);

DELETE FROM carts WHERE user_id IS NULL;

ALTER TABLE carts ALTER COLUMN user_id SET NOT NULL;

DROP INDEX IF EXISTS idx_carts_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_user_id ON carts (user_id);

-- +goose Down
-- Restores a nullable non-unique lookup index. Collapsed duplicate carts
-- and dropped guest rows are not resurrected.
DROP INDEX IF EXISTS uq_carts_user_id;

ALTER TABLE carts ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id);
