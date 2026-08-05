---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Referral complete on paid order

## Actor

Referee shopper + system

## Happy path

1. Referee claims code (or claimed at signup) → [[Referrals]]
2. Completes [[Journey First purchase]] through paid webhook
3. `PaymentService.Confirm` best-effort `referral.OnPaidOrder`
4. Pending referral completed; loyalty points to referrer + referee

## Failure branches

- No pending referral → no-op
- Loyalty award fail must not roll back payment (best-effort)

## Related

[[Payments Backend]] · [[Loyalty Wallet Gift Cards]] · [[Journey First purchase]] · [[Journeys MOC]]

#journey
