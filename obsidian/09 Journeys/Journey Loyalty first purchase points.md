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
2. `PaymentService.Confirm` commits paid + stock deduct
3. Best-effort `AwardForOrder` → `floor(amount / LOYALTY_EARN_DIVISOR)` points
4. If pending referral, [[Journey Referral complete on paid order]] also fires
5. Confirmation page explains earn **after payment** (not place-only) + link to rewards (FE PH-040c)
6. Customer opens rewards UI → balance / `order_paid` ledger row

## Notes

- Not awarded on order create alone  
- Guest without `user_id` earns nothing  
- Retried webhook does not double-grant (order id key)  

## Related

[[Loyalty Backend]] · [[Loyalty FE]] · [[Payments Backend]] · [[Journey Payment webhook settle]] · [[Journey First purchase]]

#journey
