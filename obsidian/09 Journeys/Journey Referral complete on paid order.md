---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Referral complete on paid order

## Actor

Referee shopper + system

## Happy path

1. Referee claims code (`POST /referrals/claim` → `{claimed:true}` or 400; not a silent 204) → [[Referrals]]
2. Completes [[Journey First purchase]] through paid webhook
3. `PaymentService.Confirm` retries `referral.OnPaidOrder` after the money TX (PR-003h)
4. `OnPaidOrder` **Awards both sides first**, then Completes. Award is idempotent per referral id
5. Pending referral completed; loyalty points to referrer + referee

## Failure branches

- No pending referral → no-op
- Award fail → **do not Complete**; retry can Award (replay) then Complete
- Loyalty award fail must not roll back payment ([[Payments Backend]])

## Related

[[Payments Backend]] · [[Loyalty Wallet Gift Cards]] · [[Journey First purchase]] · [[Journeys MOC]]

#journey
