---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Loyalty earn on review

**Status:** live PH-040b

## Actor

Shopper with a **verified purchase** of the product

## Happy path

1. Customer submits review on PDP / account (one per product)
2. `reviews.Service.Create` persists row with `verified_purchase=true`
3. Best-effort `loyalty.Award` with reason `review`, ref `review/{id}`, delta `LOYALTY_REVIEW_BONUS`
4. Customer sees toast «امتیاز باشگاه…» when `verified_purchase` (FE PH-040c)
5. Rewards ledger shows `reason: review` after invalidate

## Non-earn paths

- Non-buyer review allowed for content but **0 points** (toast says so)
- Duplicate review → 409, no second award
- Loyalty failure must not fail review create

## Related

[[Loyalty Backend]] · [[Loyalty FE]] · [[Loyalty Wallet Gift Cards]] · [[Reviews Backend]] · [[Journey First purchase]]

#journey
