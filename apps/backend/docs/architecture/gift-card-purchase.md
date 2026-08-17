# Gift card customer purchase (PH-042a)

**API:** [gift-cards.md](../api/gift-cards.md) · related [wallet-topup.md](./wallet-topup.md)

---

## Flow

```
POST /gift-cards/purchase { amount }
  → payment_transactions pending (order_id NULL, transaction_id = gbuy-…)
  → response includes payment_url = {PAYMENT_START_BASE_URL}?transaction_id=gbuy-…
  → customer redirects to payment_url
Webhook succeeded
  → payments.Confirm
  → giftcard.FulfillPaidPurchaseTx (same TX)
  → gift_cards row: active, purchaser_user_id, purchase_txid = gbuy-…
  → after successful new insert: email code to purchaser (PR-005b)
    (Dispatcher outbox preferred; Mailer fallback; skip if unset)
GET /gift-cards/mine → code still listed if email was skipped or failed
```

`payment_url` is empty only when `PAYMENT_START_BASE_URL` is unset
(development). Production requires the env (PR-005a). Empty URL ≠ paid.

Redeem remains separate: buyer (or recipient) `POST /gift-cards/redeem`.

---

## Distinguish orderless payments

| `transaction_id` prefix | Confirm side effect |
|-------------------------|---------------------|
| `gbuy-` | Issue gift card (no wallet credit) |
| `wtop-` (or other) | Wallet top-up credit |

---

## Idempotency

| Layer | Mechanism |
|-------|-----------|
| HTTP | `Idempotency-Key` on purchase |
| Payment | UNIQUE `transaction_id`; Confirm pending-only |
| Card issue | UNIQUE `purchase_txid` (partial index); fulfill no-ops if exists |
| Code email | Only on a successful **new** insert. Replay (`GetByPurchaseTxID` hit or concurrent conflict that already issued) returns nil without notify. Idempotency key `gift_purchase:{purchase_txid}`. |

Staff issue path unchanged (`CreateBatch`, no purchase_txid). Staff-issued
cards are not emailed.

---

## Email after paid fulfill (PR-005b)

`FulfillPaidPurchaseTx` stays inside the payment Confirm TX. After
`InsertPurchasedTx` succeeds it looks up the purchaser email
(`PurchaserEmailLookup`) and enqueues/sends. Prefer
`notifications.Dispatcher.DispatchGiftPurchased` (async outbox); else
`notify.Mailer.Send`.

| Condition | Behaviour |
|-----------|-----------|
| Mailer and dispatcher unset | Fulfill succeeds; log `reason=mailer_unset` |
| Lookup unset / no email | Fulfill succeeds; log skip; code on `/gift-cards/mine` |
| Send/enqueue fails | Fulfill succeeds; log warn; **do not** roll back the card |
| Replay (already issued) | `nil`, no notify |

Persian HTML includes the **code** and face amount. Do not log the full code
at info. Bootstrap wires `WithMailer` / `WithDispatcher` /
`WithPurchaserEmailLookup` (container owned by PR-020a).

---

## Non-goals

- Multi-currency face values
- Free issuance to customers

Staff ledger + void is **PR-056a** (`GET /admin/gift-cards`, `POST /admin/gift-cards/:id/void`). See [gift-cards.md](../api/gift-cards.md).
