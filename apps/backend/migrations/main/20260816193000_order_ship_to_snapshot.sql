-- +goose Up
-- PR-020i: persist ship-to + method/coupon snapshots so fulfillment survives
-- address edit/delete (address_id / shipping_method_id / coupon_id are ON DELETE SET NULL).
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS ship_to JSONB,
    ADD COLUMN IF NOT EXISTS shipping_method_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_method_carrier VARCHAR(100),
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(64);

UPDATE orders o
SET ship_to = jsonb_strip_nulls(jsonb_build_object(
    'full_name', a.full_name,
    'phone_number', a.phone_number,
    'address_line1', a.address_line1,
    'address_line2', a.address_line2,
    'city', a.city,
    'state_province', a.state_province,
    'postal_code', a.postal_code,
    'country', a.country
))
FROM addresses a
WHERE o.address_id = a.id
  AND o.ship_to IS NULL;

UPDATE orders o
SET
    shipping_method_name    = sm.name,
    shipping_method_carrier = sm.carrier
FROM shipping_methods sm
WHERE o.shipping_method_id = sm.id
  AND o.shipping_method_name IS NULL;

UPDATE orders o
SET coupon_code = c.code
FROM coupons c
WHERE o.coupon_id = c.id
  AND o.coupon_code IS NULL;

-- +goose Down
ALTER TABLE orders
    DROP COLUMN IF EXISTS ship_to,
    DROP COLUMN IF EXISTS shipping_method_name,
    DROP COLUMN IF EXISTS shipping_method_carrier,
    DROP COLUMN IF EXISTS coupon_code;
