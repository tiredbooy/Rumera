---
tags: [domain, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Orders

Lifecycle object from place-order through fulfillment.

## Create

Atomic TX: order + items + coupon usage + **inventory reserve**. Failure → nothing left.

Send `Idempotency-Key` on place-order for safe client retries ([[ADR Idempotency platform]]).

Post-commit: clear cart (best-effort), pending payment, later confirmation notify.

## Read

- Customer: own orders only (`uid` scope) → [[Account FE]]
- Admin: list/detail/status → [[Admin Console]]

## Status & pay

Paid only when [[Payments]] confirm succeeds. Cancel before pay → release stock.

Related: [[Cart and Checkout]] · [[Inventory]] · [[Payments Backend]] · [[Notifications]] · [[Journey First purchase]]

#domain #commerce
