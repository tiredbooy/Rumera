---
tags: [backend, wallet, account, money]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Wallet Backend

Customer balance + ledger. Self-service free deposit is not exposed.

## Package (feature slice)

```text
apps/backend/internal/features/wallet/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go → mapper.go
```

Mounted from `internal/routes/routes.go`:

- `wallet.RegisterCustomer` — GET `/wallet`, GET `/wallet/transactions`, POST `/wallet/topup` (money mw), POST `/wallet/withdraw` → **410 Gone**
- `wallet.RegisterAdmin` — POST `/admin/users/:userID/wallet/credit` (+ money idempotency mw)

## Credit sources (allowed)

- Admin credit (**service** `idem=<key>` + **HTTP** platform)
- Loyalty redeem → `wallet.Service.Deposit`
- Gift-card redeem
- **Gateway top-up (PH-041a)** — `POST /wallet/topup` → pending payment + `payment_url` (PR-005a) → webhook Confirm → `CreditGatewayTopUpTx` (`topup_txid=` marker)
- Payment refunds
- **Checkout purchase (PR-020a)** — `orders` calls `PurchaseTx` on the create TX (with `MarkAsPaid` + `DeductForOrderTx`). No unpaid payment row.

## Gateway top-up

Bridge: `apps/backend/docs/architecture/wallet-topup.md`  
Journey: [[Journey Account wallet top-up]]

## Related

[[Account Domain]] · [[Money and stock rules]] · [[Payments Backend]] · [[Orders]] · [[ADR Idempotency platform]] ·  
[[Playbook Debug Idempotency]] · [[Loyalty Wallet Gift Cards]]

API: `apps/backend/docs/api/wallet.md`

#backend #wallet
