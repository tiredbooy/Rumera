# Wallet gateway top-up (PH-041a)

**Who this is for:** engineers changing customer wallet charge / payment Confirm.

**API:** [wallet.md](../api/wallet.md) · **Payments:** [payments-and-webhooks.md](./payments-and-webhooks.md)  
**Money sagas:** [money-and-stock-sagas.md](./money-and-stock-sagas.md)

---

## Decision

Customer balance may grow only after a **real gateway payment**, never via free
`POST /wallet/deposit`. Self-service withdraw remains **410 Gone**.

Flow:

```
Customer POST /wallet/topup { amount }
  → pending payment_transactions (order_id NULL, transaction_id = wtop-…)
  → FE pays gateway with that transaction_id
Webhook POST /webhooks/payment status=succeeded
  → payments.Confirm
  → payment succeeded + wallet deposit (same TX)
  → description marker topup_txid=<gateway id> (idempotent credit)
```

---

## Amount bounds (IRT / Toman)

| Constant | Value |
|----------|-------|
| `MinWalletTopUpAmount` | 10 000 |
| `MaxWalletTopUpAmount` | 50 000 000 |

Currency is **IRT** only (no multi-currency).

---

## Idempotency

| Layer | Mechanism |
|-------|-----------|
| HTTP | `Idempotency-Key` on `POST /wallet/topup` (money middleware, PH-011) |
| Payment row | UNIQUE `payment_transactions.transaction_id` |
| Confirm | Pending-only transition; terminal → webhook ACK |
| Wallet credit | `topup_txid=` marker in deposit description; second Confirm credit is no-op if already deposited |

---

## Confirm branching

| `payment.order_id` | Side effects in Confirm TX |
|--------------------|----------------------------|
| **Set** | Mark order paid + stock deduct (+ loyalty/referral after commit) |
| **NULL** (top-up) | `wallet.CreditGatewayTopUpTx` only |

Fail path with null order: no stock release.

---

## Explicit non-goals

- Free public deposit
- Re-opening withdraw
- Multi-currency top-up
- Gateway SDK embed (intent returns `transaction_id` for external pay)
