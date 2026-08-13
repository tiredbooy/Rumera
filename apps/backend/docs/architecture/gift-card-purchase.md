# Gift card customer purchase (PH-042a)

**API:** [gift-cards.md](../api/gift-cards.md) · related [wallet-topup.md](./wallet-topup.md)

---

## Flow

```
POST /gift-cards/purchase { amount }
  → payment_transactions pending (order_id NULL, transaction_id = gbuy-…)
  → customer pays gateway
Webhook succeeded
  → payments.Confirm
  → giftcard.FulfillPaidPurchaseTx (same TX)
  → gift_cards row: active, purchaser_user_id, purchase_txid = gbuy-…
GET /gift-cards/mine → deliver code to buyer
```

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

Staff issue path unchanged (`CreateBatch`, no purchase_txid).

---

## Non-goals

- Multi-currency face values
- Email delivery (FE/notify later)
- Free issuance to customers
