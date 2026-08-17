---
tags: [domain, payments]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Payments

Settlement of [[Orders]] — not free-form staff “mark paid” over random HTTP.

## Flow

1. CreateOrder (non-wallet) → pending `payment_transaction` **in the same TX** as the order + [[Inventory]] reserve (PR-020f). Fail the payment insert → no order. Response includes `{payment_id, transaction_id, payment_url}`. Wallet checkout does **not** open a pending row ([[Orders]]).
2. Gateway / method (card, bank, crypto, …). Wallet top-up + gift buy return `payment_url` = `{PAYMENT_START_BASE_URL}?transaction_id=` (PR-005a; [[Payments Backend]] · [[Journey Account wallet top-up]]). [[Account FE]] shows «پرداخت در درگاه» only when that URL is non-empty (PR-030c). After webhook fail, owner `POST /orders/:id/pay` (new pending if none / previous failed; refuse if already paid).
3. `POST /webhooks/payment` HMAC → confirm or fail
4. Confirm: mark paid + **deduct** stock + `payment_loyalty_awards` intent; retry earn after commit (PR-003h). Payment stays paid if loyalty fails. Then record recs `purchase` per order-line product (PR-050d; log on failure). Then send the paid receipt email (PR-020o; log on failure). Wallet/gift Confirm does not. Unpaid `POST /orders` does not email a receipt.
5. Fail: record + **release** stock

## Surfaces

- Checkout method step → [[Cart and Checkout]]
- Confirmation page reads order state (does not settle)
- Admin payments board (read-only). Response `user_id` is the public UUID (`users.user_id`), same as [[Customers Admin]] `/admin/customers/:id` — not `users.id`. List/detail jump there (PR-064d). List filter `user_id` stays the internal integer.

## Related

[[Payments Backend]] · [[Journey Payment webhook settle]] · [[Journey Idempotent retry checkout webhook]] ·  
[[Journey First purchase]] · [[Playbook Debug Webhook]] · [[Playbook Debug Idempotency]] · [[Loyalty Wallet Gift Cards]] · [[Money and stock rules]]

#domain #payments
