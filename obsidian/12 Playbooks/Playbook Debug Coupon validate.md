---
tags:
  - playbook
  - coupons
  - checkout
aliases:
  - Debug coupon validate
  - Scoped coupon preview invalid
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug Coupon validate

## Symptoms

Checkout says the code is invalid, but place-order with the same code succeeds (or staff think a scoped coupon is dead). `is_valid: false` with “does not apply to items in your cart” or “minimum order amount”.

## Checks

1. Client body — storefront checkout often sends `{code, order_subtotal}` only (`checkout-flow.tsx`). Scoped `applicable_to` needs product/category IDs.
2. **PR-020n:** when IDs are both empty and/or `order_subtotal` is 0, `POST /coupons/validate` loads the token user's cart (`GetOrCreate` + `GetItems`) and derives IDs + line-total subtotal. Preview should match CreateOrder's basket ([[Shipping and Coupons]] · [[Cart and Checkout]]).
3. Empty cart → `200` + `is_valid: false` (min-order or applicability). Not a 500. Unknown code is the same invalid shape (not 404).
4. Validate **does not** increment `coupon_usages`. Redemption is under lock at order create ([[Coupons Backend]] · [[Orders Backend]]).
5. Cart lookup SQL/repo failure → `500 INTERNAL_ERROR`. Confirm `carts.user_id` unique (PR-004a) and `GetItems` joins active product/variant.
6. If IDs **and** a non-zero subtotal were sent, the server does **not** overwrite them — a client-supplied empty/wrong ID list still fails scoped codes.

API: `apps/backend/docs/api/coupons.md`.

## Related

[[Shipping and Coupons]] · [[Cart and Checkout]] · [[Coupons Backend]] · [[Cart Backend]] · [[Journey First purchase]]

#playbook #coupons
