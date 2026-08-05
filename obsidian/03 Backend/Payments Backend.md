---
tags:
  - backend
  - payments
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Payments Backend

Payments are **not** free-form admin creates.

```text
CreateOrder → reserve stock → pending payment_transaction
     → gateway / method
     → POST /webhooks/payment (HMAC)
          succeeded → Confirm (paid + deduct) + loyalty/referral best-effort
          failed    → Fail + release stock
```

Admin: read-only list/get transactions.

Related: [[Payments]] · [[Orders]] · [[Inventory Backend]] · [[Loyalty Wallet Gift Cards]] · [[Cart and Checkout]]

Bridge: `apps/backend/docs/architecture/payments-and-webhooks.md`

#backend #payments
