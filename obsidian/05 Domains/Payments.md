---
tags: [domain, payments]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Payments

Settlement of [[Orders]] — not free-form staff “mark paid” over random HTTP.

## Flow

1. CreateOrder → pending `payment_transaction` + [[Inventory]] reserve (already held)
2. Gateway / method (card, bank, wallet, crypto, …)
3. `POST /webhooks/payment` HMAC → confirm or fail
4. Confirm: mark paid + **deduct** stock + best-effort loyalty/referral
5. Fail: record + **release** stock

## Surfaces

- Checkout method step → [[Cart and Checkout]]
- Confirmation page reads order state (does not settle)
- Admin payments board (read-only)

## Related

[[Payments Backend]] · [[Journey Payment webhook settle]] · [[Journey Idempotent retry checkout webhook]] ·  
[[Playbook Debug Webhook]] · [[Playbook Debug Idempotency]] · [[Loyalty Wallet Gift Cards]] · [[Money and stock rules]]

#domain #payments
