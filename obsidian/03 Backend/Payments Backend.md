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

Gateway intents attach `payment_url` = `{PAYMENT_START_BASE_URL}?transaction_id={id}`
(PR-005a). Not a PSP client. Production requires the env; empty URL in
dev is **not** paid. Wallet/gift JSON: [[Wallet Backend]] · [[Gift Card Backend]].
Order response attach is later (PR-020f).

Payments are **not** free-form admin creates.

```text
CreateOrder → reserve stock → pending payment_transaction
     → gateway / method
     → POST /webhooks/payment (HMAC + HTTP idempotency)
          succeeded → Confirm (paid + deduct + payment_loyalty_awards intent)
                      then retry AwardForOrder / OnPaidOrder (PR-003h)
                      then recs purchase per order-line product (PR-050d)
                      then paid receipt email (PR-020o)
          failed    → Fail + release stock
```

**Replay safety (PH-011):**

1. HTTP `idempotency_keys` (auto body-hash on webhook)
2. **UNIQUE** `payment_transactions.transaction_id` (`uq_payment_transactions_transaction_id`)
3. Confirm/Fail only from **pending**; already terminal → webhook **200** `{replayed:true}`

Admin: read-only list/get transactions. DTO `user_id` is `users.user_id`
(UUID), same as `/admin/customers/:id` — never the internal `users.id`
(PR-064d). Omitted when unresolved. List filter `user_id` is still
`users.id`.

Earn after pay is **durable**: same-TX `payment_loyalty_awards` row; mark
`awarded_at` only after `AwardForOrder` succeeds. Payment does **not** roll
back if loyalty fails after commit. Leftovers: `ProcessPendingLoyaltyAwards`.
Referral Awards both sides **before** Complete ([[Referral Backend]]).

Related: [[Payments]] · [[Orders]] · [[Inventory Backend]] · [[Loyalty Wallet Gift Cards]] · [[Cart and Checkout]] · [[ADR Idempotency platform]] · [[Journey Idempotent retry checkout webhook]] · [[Journey Loyalty first purchase points]] · [[Playbook Debug Idempotency]] · [[Playbook Debug Webhook]]

Bridge: `apps/backend/docs/architecture/payments-and-webhooks.md` · `architecture/idempotency.md` · `architecture/idempotency-runbook.md`

#backend #payments
