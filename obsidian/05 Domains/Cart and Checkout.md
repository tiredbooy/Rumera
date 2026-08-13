---
tags: [domain, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Cart and Checkout

## Cart

- Per-user cart lines with price snapshots
- Mutations via [[BFF Proxies]] store client + React Query
- Must respect available stock at add/checkout time

## Checkout

Steps typically: address → shipping quote → payment method → review → place order.

Server authorities:

- Address ownership
- Shipping region from **address country** (never a client constant)
- **Package weight** = Σ cart line `weight_kg × qty` (PH-020c); FE quotes with same sum; BE re-sums at CreateOrder
- Coupon under lock
- Totals
- Creates [[Orders]] + reserve [[Inventory]] + pending [[Payments]]
- **Gift mode (PH-060):** optional modular packaging / add-ons from [[Site Settings]] `gift.options`; FE shows prices for preview; BE re-prices and adds `gift_addons_fee` to total (see [[Journey Buy as gift]])

## FE

[[Storefront Commerce FE]] · `features/checkout` · `features/cart`

## Related

[[Shipping and Coupons]] · [[Journey First purchase]] · [[Account Domain]] (addresses) · [[Surface Storefront]]

#domain #commerce
