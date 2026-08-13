---
tags:
  - backend
  - payments
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Payments Backend

## Package (feature slice)

```text
apps/backend/internal/features/payments/
  doc.go → routes.go → handler.go → webhook.go → service.go → repository.go → model.go
```

| Surface | Paths |
|---------|--------|
| Public | `POST /webhooks/payment` (HMAC + idempotency) |
| Admin | `GET /admin/payments`, by-id, by-transaction |

Orders create pending payments via `Service.Create`. Confirm deducts stock atomically.

Payments are **not** free-form admin creates.

```text
CreateOrder → reserve stock → pending payment_transaction
     → gateway / method
     → POST /webhooks/payment (HMAC + HTTP idempotency)
          succeeded → Confirm (paid + deduct) + loyalty/referral best-effort
          failed    → Fail + release stock
```

**Replay safety (PH-011):**

1. HTTP `idempotency_keys` (auto body-hash on webhook)
2. **UNIQUE** `payment_transactions.transaction_id` (`uq_payment_transactions_transaction_id`)
3. Confirm/Fail only from **pending**; already terminal → webhook **200** `{replayed:true}`

Admin: read-only list/get transactions.

Related: [[Payments]] · [[Orders]] · [[Inventory Backend]] · [[Loyalty Wallet Gift Cards]] · [[Cart and Checkout]] · [[ADR Idempotency platform]] · [[Journey Idempotent retry checkout webhook]] · [[Playbook Debug Idempotency]] · [[Playbook Debug Webhook]]

Bridge: `apps/backend/docs/architecture/payments-and-webhooks.md` · `architecture/idempotency.md` · `architecture/idempotency-runbook.md`

#backend #payments
