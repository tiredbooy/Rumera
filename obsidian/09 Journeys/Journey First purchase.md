---
tags: [journey, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: First purchase

## Steps

1. Land [[Hero and Home]] / [[Catalogue]] / [[Search]]
2. Open PDP → pick [[Term variant]] → add cart (auth-only, one cart per user; lines may include `weight_kg`). BE records `add_to_cart` on the parent product (PR-050d)
3. [[Cart and Checkout]] address (region = country) + shipping quote with **package weight sum** (PH-020c) + coupon + payment method. Coupon preview may send only `{code, order_subtotal}`; the server fills omitted product/category IDs from the caller cart (PR-020n — [[Shipping and Coupons]] · [[Playbook Debug Coupon validate]]). Payment step links to [[Loyalty FE]] `/account/rewards` without inventing unpaid earn amounts (PR-003m)
4. Place order → [[Orders]] created · [[Inventory]] **reserve** · BE re-sums weight + authorizes shipping
5. **Wallet rail:** same TX as step 4 — [[Wallet Backend]] `PurchaseTx` + mark paid + deduct (PR-020a). Status comes back `paid` (confirmation can celebrate). Insufficient funds → `INSUFFICIENT_FUNDS`, no order ([[Money and stock rules]]).
6. **Other rails:** pending [[Payments]] · confirmation shows «سفارش ثبت شد» / «در انتظار پرداخت» until paid-like (PR-030a — not «سفارش تأیید شد»). Earn after paid — [[Journey Loyalty first purchase points]]. Webhook success → paid · **deduct** · same-TX earn intent · retry loyalty ([[Loyalty Wallet Gift Cards]]) — payment does not roll back if points fail ([[Journey Payment webhook settle]]). Then BE records recs `purchase` per line product (PR-050d); unpaid checkout does not.
7. Paid receipt email [[Notifications]] after Confirm (or immediately on wallet-paid create). Unpaid place does not send “order confirmed” (PR-020o).
8. View under [[Account FE]] orders

## Failure branches

- Insufficient stock at place → whole order rolls back
- Wallet short at place → `INSUFFICIENT_FUNDS`; reserve + order roll back (PR-020a)
- Inactive parent product (or variant) on add-to-cart → `PRODUCT_UNAVAILABLE`; line is not inserted ([[Cart Backend]])
- Pay fail → release stock
- Session missing → [[Journey OTP login]] / login

Related: [[Money and stock rules]] · [[Journey Payment webhook settle]] · [[Journey Idempotent retry checkout webhook]] · [[Surface Storefront]]

#journey
