---
tags:
  - domain
  - commerce
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Shipping and Coupons

- Shipping quotes **authoritative** on server. Storefront region is uppercase `state_province` when it is a code (`IR-…`), else address country (`IR`). Server matches exact codes and a country fallback (`IR` → zones with `IR` or any `IR-*`). CreateOrder still authorizes with `address.Country`.
- Coupons re-validated under lock at order time
- Free-shipping coupon type zeros shipping cost
- `POST /coupons/validate` previews only (no usage write). When `product_ids` / `category_ids` are omitted and/or `order_subtotal` is 0, the server loads the caller's [[Cart and Checkout]] and derives IDs + subtotal (PR-020n). Empty cart → `is_valid: false`, not 500. Checkout may send `{code, order_subtotal}` only; scoped codes then match CreateOrder. See [[Playbook Debug Coupon validate]].

Backend packages: [[Shipping Backend]] (`features/shipping`) · [[Coupons Backend]] (`features/coupons`).

Used by [[Cart and Checkout]] · admin shipping/coupon boards in [[Admin Console]].

#domain #commerce
