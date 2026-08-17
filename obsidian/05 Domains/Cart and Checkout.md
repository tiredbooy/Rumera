---
tags: [domain, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Cart and Checkout

## Cart

- **One cart per authenticated user** — `UNIQUE NOT NULL` on `carts.user_id` (PR-004a). `GetOrCreate` is `INSERT … ON CONFLICT (user_id)`. No guest carts (401).
- Per-user cart lines with price snapshots
- Cart line `options` are hydrated from catalogue variant option values ([[Catalogue]] · [[Cart Backend]]) in one query (`product_variants_options` → `option_values` → `option_types`). Empty/omitted when the variant has none.
- Mutations via [[BFF Proxies]] store client + React Query
- Must respect available stock at add/checkout time
- Successful add records server-side `add_to_cart` for [[Recommendations]] (PR-050d); recs failure does not fail the cart

## Checkout

Steps typically: address → shipping quote → payment method → review → place order.

Payment step links to `/account/rewards` ([[Loyalty FE]]); earn is after paid, never a client-invented amount ([[Journey First purchase]], PR-003m).

`bank_transfer` copy (PR-030d, `checkout-payment-step.tsx`): customer pays **offline**; order stays pending until staff mark paid. No IBAN / account-number API — do not invent digits or imply instant / already-confirmed pay. Wallet can settle on create (PR-020a) and is not operator-wait.

Confirmation (`order-confirmation-view.tsx`, PR-030a) matches server order status: paid-like may say «سفارش تأیید شد» / «سپاس از خرید شما»; `pending` / `payment_failed` / other unpaid say «سفارش ثبت شد» + `ORDER_STATUS_FA` (e.g. «در انتظار پرداخت»). Do not imply money taken. See [[Playbook Confirmation status copy]].

Server authorities:

- Address ownership
- Shipping region from **address country** (never a client constant)
- **Package weight** = Σ cart line `weight_kg × qty` (PH-020c); FE quotes with same sum; BE re-sums at CreateOrder
- Coupon under lock. Preview (`POST /coupons/validate`) fills omitted product/category IDs and a zero subtotal from this cart (PR-020n — [[Shipping and Coupons]] · [[Playbook Debug Coupon validate]])
- Totals
- Creates [[Orders]] + reserve [[Inventory]] + pending [[Payments]]
- **Gift mode (PH-060):** optional modular packaging / add-ons from [[Site Settings]] `gift.options`; FE shows prices for preview; BE re-prices and adds `gift_addons_fee` to total (see [[Journey Buy as gift]])

## FE

[[Storefront Commerce FE]] · `features/checkout` (wizard UI + package-weight only; no local api/types/validations — PR-035d) · `features/cart`

## Related

[[Shipping and Coupons]] · [[Journey First purchase]] · [[Account Domain]] (addresses) · [[Surface Storefront]]

#domain #commerce
