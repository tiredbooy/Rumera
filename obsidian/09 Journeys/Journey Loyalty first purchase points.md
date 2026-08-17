---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Loyalty first purchase points

**Status:** live (as-built)

## Actor

Logged-in shopper

## Happy path

1. [[Journey First purchase]] through gateway webhook success
2. `PaymentService.Confirm` commits paid + stock deduct + `payment_loyalty_awards` intent
3. Post-commit retry `AwardForOrder` → `floor(amount / LOYALTY_EARN_DIVISOR)` points. Failed award leaves `awarded_at` NULL; payment stays paid ([[Payments Backend]])
4. If pending referral, [[Journey Referral complete on paid order]] also fires (Award then Complete)
5. Checkout payment step links to `/account/rewards` without inventing points ([[Storefront Commerce FE]], PR-003m). Confirmation page explains earn **after payment** (not place-only) + link to rewards (FE PH-040c)
6. Customer opens rewards UI → balance / `order_paid` ledger row from paginated `GET /loyalty/transactions` (`{results, pagination}`, includes `id` / `ref_*`; [[Loyalty FE]])

## Notes

- Not awarded on order create alone  
- Guest without `user_id` earns nothing  
- Retried webhook does not double-grant (order id key)
- Full `refunded` status claws the order earn (balance only; not lifetime). Retry is idempotent ([[Journey Admin refund restock]])

## Related

[[Loyalty Backend]] · [[Loyalty FE]] · [[Payments Backend]] · [[Journey Payment webhook settle]] · [[Journey First purchase]]

#journey
