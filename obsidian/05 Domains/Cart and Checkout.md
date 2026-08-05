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
- Shipping region from **address country**
- Coupon under lock
- Totals
- Creates [[Orders]] + reserve [[Inventory]] + pending [[Payments]]

## FE

[[Storefront Commerce FE]] · `features/checkout` · `features/cart`

## Related

[[Shipping and Coupons]] · [[Journey First purchase]] · [[Account Domain]] (addresses) · [[Surface Storefront]]

#domain #commerce
