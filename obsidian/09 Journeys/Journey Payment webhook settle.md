---
tags: [journey, payments]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Payment webhook settle

1. Gateway POSTs signed body to `/webhooks/payment`
2. HMAC with `CRYPTO_WEBHOOK_KEY` ([[Payments Backend]])
3. `succeeded` → Confirm TX: payment + order paid + inventory deduct
4. Best-effort: loyalty, referral, (order email)
5. `failed` → Fail + release stock

Idempotent layers (PH-011a–d): HTTP middleware + **UNIQUE** `transaction_id` +
pending-only Confirm/Fail + terminal **200 ACK** on redelivery.  
See [[Journey Idempotent retry checkout webhook]] · [[ADR Idempotency platform]].

Related: [[Payments]] · [[Inventory]] · [[Playbook Debug Webhook]] · [[Money and stock rules]]

#journey
