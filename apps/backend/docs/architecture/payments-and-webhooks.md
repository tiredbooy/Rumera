# Payments and webhooks

**Who this is for:** anyone wiring checkout, a payment gateway, admin payment
views, or debugging “order placed but stock wrong.”

**API reference:** [payments.md](../api/payments.md) · [webhooks.md](../api/webhooks.md) ·
[orders.md](../api/orders.md)  
**Frontend:** [storefront-commerce.md](../../../frontend/docs/features/storefront-commerce.md) ·
admin [payments feature](../../../frontend/features/payments/)

---

## The rule: `order.paid.v1` is the only paid signal (A-5)

`payment_transactions` is the **gateway** ledger. The wallet rail settles inside
the order transaction and writes **no row here at all** — so this table answers
*"what did the PSP do"*, never *"was this order paid"*.

**Never hook `Confirm` to add a post-payment feature.** Subscribe to
`order.paid.v1`: both rails emit it, under the same order-keyed idempotency key
(`order:{id}:paid`), inside the same transaction as the money. Loyalty and
recommendations were each wired to `Confirm` once, and each silently skipped
every wallet buyer until they were moved onto the fact.

Pinned by `TestWalletRailEmitsTheOnlyPaidSignalItHas` — the wallet rail writes
zero payment rows and emits exactly one fact, with `PaymentID` absent.

### Why not just give wallet a row

Because the row is live gateway state, not a receipt:

- `attachPaymentURL` builds a **pay-start link from `transaction_id` for every
  row it returns** — an operator would get a gateway payment link for money that
  never went to a PSP and is already settled.
- `Confirm` **prefix-routes on `transaction_id`**, and its order-less `default:`
  branch **credits wallet balance**. Fabricated identifiers would live in a
  namespace addressable from the webhook.
- `transaction_id` is `NOT NULL UNIQUE` and documented as the gateway's id, so a
  wallet row means inventing one.
- **No revenue report reads this table.** Reporting sums the analytics `events`
  stream, which already has a dedicated `wallet` bucket — a wallet row here adds
  nothing to any financial figure.

The operator gap it leaves is real but different: `wallet_transactions` already
records the debit keyed by `reference_order_id`, and simply has no admin read
route. That is the cheap fix, not a fake gateway record.

## Mental model

Payments are **not** created by a public “pay” REST resource the client invents.
They are a **side effect of placing an order**, then settled by a **signed
gateway webhook**. Admin HTTP only **reads** transactions.

```
Checkout (customer JWT)
        │  CreateOrder
        ▼
┌───────────────────────────────────────────────┐
│ SAME DB TX                                    │
│  order + items + coupon usage                 │
│  + inventory RESERVE (committed/held stock)   │
└───────────────────────────────────────────────┘
        │ commit
        ▼
  clear cart (best-effort)
  create PENDING payment_transaction (best-effort)
        │
        │  customer redirected / gateway charges
        ▼
POST /webhooks/payment  (HMAC-signed, no JWT)
        │
        ├─ status=succeeded → PaymentService.Confirm
        │     SAME TX: payment succeeded + order paid + inventory DEDUCT
        │              + payment_loyalty_awards intent (order + user_id)
        │     then retry AwardForOrder + OnPaidOrder; leftover rows stay pending
        │     (payment does not roll back if loyalty fails after commit)
        │     then record recs purchase per order-line product_id (PR-050d;
        │     log on failure; unpaid / orderless Confirm does not write)
        │     then send the paid receipt email (PR-020o; log on failure)
        │
        └─ status=failed → PaymentService.Fail
              then Release reserved stock for the order
```

**Rule:** an order must never show **paid** without a confirmed payment row, and
stock must not be **deducted** outside that same confirmation transaction.

---

## Order placement (backend)

**Service:** `internal/features/orders/service.go` → `CreateOrder`

1. Resolve cart for `userID`; reject empty cart.
2. Snapshot subtotal and package weight from cart lines.
3. Load address (ownership-scoped); derive shipping **region from address
   country** (client cannot override).
4. Authorize shipping method + quote (authoritative).
5. Optional coupon: pre-validate, then re-validate under `FOR UPDATE` inside the
   order transaction.
6. In one transaction:
   - insert order + items
   - record coupon usage if any
   - **`inventory.ReserveForOrderTx`** for all lines  
     Insufficient stock → whole order rolls back (no dangling pending order).
7. After commit:
   - clear cart (non-fatal if it fails)
   - `createPendingPayment` with a generated `transaction_id`, amount =
     `order.TotalAmount`, method from request

Pending payment creation is **best-effort**: the gateway is still the source of
truth for settlement; a missing pending row is a ops problem, not a silent
“order paid.” `payments.Create` attaches `PaymentURL` =
`{PAYMENT_START_BASE_URL}?transaction_id={id}` on the payment row (PR-005a).
`POST /orders` does **not** yet return that URL (PR-020f).

### Payment start URL (PR-005a)

Gateway intents (`CreateWalletTopUp`, `CreateGiftCardPurchase`, and checkout
`Create`) build:

```
{PAYMENT_START_BASE_URL}?transaction_id={transaction_id}
```

This is **not** a PSP client and **not** a customer `POST /payments/:id/start`
route. Operators must set `PAYMENT_START_BASE_URL` in production
(`Config.Validate` fails boot otherwise). Development may omit it; then
`payment_url` is empty and the customer cannot pay via redirect. Never treat
an empty URL as a successful pay.

### Payment methods (wire)

From models / admin docs: `card`, `crypto`, `bank_transfer`, `wallet`,
`gateway` (and frontend checkout labels map onto the same enum).

Currency defaults are set server-side when creating the transaction (see
`defaultCurrency` in order service).

---

## Webhook settlement

**Handler:** `internal/features/payments/webhook.go` → payment webhook handler  
**Route:** `POST /webhooks/payment` (public tier, **not** JWT)

### Security

| Check | Behavior |
|-------|----------|
| `CRYPTO_WEBHOOK_KEY` empty | **503** — endpoint disabled (fail closed) |
| Missing/bad `X-Webhook-Signature` | **401** |
| Body | Must be signed as **raw bytes** (no re-JSON) |

```
X-Webhook-Signature: hex(hmac_sha256(rawBody, CRYPTO_WEBHOOK_KEY))
```

Production config validation requires `CRYPTO_WEBHOOK_KEY` so orders can
actually confirm.

### Payload

```json
{
  "transaction_id": "…",
  "status": "succeeded" | "failed",
  "error_message": "optional on failure"
}
```

### Succeeded → `PaymentService.Confirm`

In **one** DB transaction:

1. Mark `payment_transactions` succeeded (only from pending). Already settled →
   Confirm returns not-found; webhook **ACKs 200** if the row is terminal
   (`replayed: true`) so the gateway stops without re-side-effecting.
2. Mark order paid.
3. **`inventory.DeductForOrderTx`** for order items (was previously a separate
   discarded step — now atomic to avoid paid-without-deduct drift).

After commit (must not undo payment — PR-003h):

- Process `payment_loyalty_awards` (same TX as money/stock): bounded retry of
  `AwardForOrder` (idempotent by order id) then `OnPaidOrder`. Mark
  `awarded_at` only after `AwardForOrder` succeeds. If still failing, **leave
  the row** and log; Confirm still returns the paid payment.
  `ProcessPendingLoyaltyAwards` is exported so leftover rows can be retried
  (Confirm also sweeps pending intents).
- Referral: `OnPaidOrder` **Awards both sides before Complete**. Award is
  idempotent per referral id; an Award error leaves the pending row for replay.
- Wallet / gift-card payments (`order_id` null) do **not** write an earn
  intent and do not award order points — [wallet-topup.md](./wallet-topup.md)
  (PH-041a). They also do **not** write recommendation `purchase` rows.
- After a successful order Confirm, `RecordPurchasesForOrder` inserts one
  `purchase` interaction per distinct line `product_id` (PR-050d). Missing
  products are skipped; a recs error is logged and does **not** undo payment.
  See [recommendations.md](../api/recommendations.md).
- Full earn/clawback rules: [loyalty.md](./loyalty.md)
- Paid receipt email (`orders.ReceiptSender` → `DispatchOrderConfirmed`)
  after a successful **order** Confirm (PR-020o). Unpaid `POST /orders`
  does not send. Wallet checkout (already paid on create) sends from the
  orders handler. Wallet top-up / gift-buy Confirm (`order_id` null) do
  **not** send an order receipt. Copy says paid and confirmed — not
  “being processed”. Send failure is logged and does **not** undo payment.
  See [notifications-kafka.md](./notifications-kafka.md).

### Failed → `PaymentService.Fail` + release

1. Record failure + raw gateway payload.
2. **Release** reserved inventory for the order so stock returns to sale.

### Idempotency / duplicates (PH-011 layers)

1. **HTTP middleware** on `POST /webhooks/payment` (`idempotency_keys`, auto
   body-hash key when header omitted) — claim → store 2xx → replay.
2. **UNIQUE** `payment_transactions.transaction_id`
   (`uq_payment_transactions_transaction_id`, migration
   `20260811180000_payment_transaction_id_unique.sql`) — gateway natural key;
   duplicate insert → conflict.
3. **Domain:** Confirm/Fail only transition **pending** rows; late duplicates
   do not double-deduct. Webhook handler **ACKs 200** with `replayed: true`
   when the row is already terminal (so the gateway stops).

Full design: **[idempotency.md](./idempotency.md)**.  
Cron `idempotency_cleanup_job` prunes HTTP keys older than
`IDEMPOTENCY_KEY_RETENTION` (default 30 days).

---

## Admin surface

| Endpoint | Role |
|----------|------|
| `GET /admin/payments` | Filter by user, order, status |
| `GET /admin/payments/:id` | Internal id |
| `GET /admin/payments/by-transaction/:txid` | Gateway id |

No admin create/update payment — prevents staff from forging settlement.
Frontend: `features/payments` (types, presentation helpers, admin boards).

Display helpers must **not** run money through IEEE floats when formatting
decimal strings (`formatPaymentAmount` in `presentation.ts`).

---

## Frontend journey

1. Checkout collects address, shipping, coupon, **payment method**.
2. `placeOrder` → customer order API (BFF `/api/store/...`) → `CreateOrder`.
3. Redirect to confirmation `/checkout/confirmation/[id]` — page **reads**
   order state; it does not confirm payment itself.
4. Real card/crypto gateways (when integrated) redirect/callback outside this
   app; the **only** authority that marks paid is the webhook → `Confirm`.

Until a live gateway is fully integrated, methods like bank transfer / wallet
still create the same pending transaction model; ops must understand which
methods auto-webhook vs manual follow-up. Card/crypto start is the
`payment_url` on wallet/gift intents (and on the payment model after
`Create`); FE consume is PR-030c.

---

## Failure modes cheat-sheet

| Symptom | Likely cause |
|---------|----------------|
| Order exists, stock gone, never paid | Reserve held; payment never confirmed — release via Fail or cancel path |
| Paid in gateway, order still pending | Webhook secret wrong, signature over re-serialized body, or worker not reaching API |
| Paid but stock still reserved | Old bug path; current code deducts inside Confirm — check deploy version |
| Double loyalty points | Should be blocked by order-id idempotency; inspect loyalty ledger |
| Paid but no points | `payment_loyalty_awards.awarded_at` NULL — retry `ProcessPendingLoyaltyAwards`; Award is idempotent |
| 503 on webhook | `CRYPTO_WEBHOOK_KEY` unset |

---

## Related code

| Area | Path |
|------|------|
| Confirm / Fail | `internal/features/payments/service.go` |
| Webhook | `internal/features/payments/webhook.go` |
| Payment domain + wire types | `internal/features/payments/model.go` (+ `mapper.go`) |
| Order + reserve | `internal/features/orders/service.go` |
| Inventory reserve / deduct / release | [inventory.md](./inventory.md) · `internal/features/inventory/service.go` |
| Shared payment rail enum | `internal/models/payment_method.go` (orders + payments; cycle avoidance) |
| Shared money sentinels | `internal/models/errors.go` |
| Integration tests | inventory + coupon concurrency under `tests/integration/` |

Payment transaction entities are **feature-local** under `features/payments` —
not `internal/models` (PH-012a).
