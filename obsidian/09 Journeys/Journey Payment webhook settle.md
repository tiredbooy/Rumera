---
tags: [journey, payments]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Payment webhook settle

1. Gateway POSTs signed body to `/webhooks/payment`
2. HMAC with `CRYPTO_WEBHOOK_KEY` ([[Payments Backend]])
3. `succeeded` → Confirm TX: payment + order paid (`MarkAsPaid` stamps `paid_at`, PR-020h) + inventory deduct + `payment_loyalty_awards` intent
4. After commit: retry `AwardForOrder` + `OnPaidOrder` (PR-003h). Leave the intent pending if still failing; **do not** roll back the payment. Then paid receipt email (PR-020o; log on failure — does not undo payment).
5. `failed` → Fail + release stock

Idempotent layers (PH-011a–d): HTTP middleware + **UNIQUE** `transaction_id` +
pending-only Confirm/Fail + terminal **200 ACK** on redelivery.  
See [[Journey Idempotent retry checkout webhook]] · [[ADR Idempotency platform]].

Related: [[Payments]] · [[Inventory]] · [[Playbook Debug Webhook]] · [[Money and stock rules]]

#journey
