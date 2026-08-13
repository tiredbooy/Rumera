# Payments and webhooks

**Who this is for:** anyone wiring checkout, a payment gateway, admin payment
views, or debugging “order placed but stock wrong.”

**API reference:** [payments.md](../api/payments.md) · [webhooks.md](../api/webhooks.md) ·
[orders.md](../api/orders.md)  
**Frontend:** [storefront-commerce.md](../../../frontend/docs/features/storefront-commerce.md) ·
admin [payments feature](../../../frontend/features/payments/)

---

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
        │     then best-effort: loyalty AwardForOrder, referral OnPaidOrder
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
“order paid.”

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

After commit (best-effort, must not undo payment):

- Loyalty points for the order (`AwardForOrder`, idempotent by order id) — full earn/clawback rules: [loyalty.md](./loyalty.md)
- **Wallet top-up payments** (`order_id` null): Confirm credits wallet instead of order/stock — [wallet-topup.md](./wallet-topup.md) (PH-041a)
- Referral completion on referee’s first paid order (`OnPaidOrder`)
- Order confirmation email via notifications Dispatcher (when wired on order
  path — see notifications architecture)

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
methods auto-webhook vs manual follow-up.

---

## Failure modes cheat-sheet

| Symptom | Likely cause |
|---------|----------------|
| Order exists, stock gone, never paid | Reserve held; payment never confirmed — release via Fail or cancel path |
| Paid in gateway, order still pending | Webhook secret wrong, signature over re-serialized body, or worker not reaching API |
| Paid but stock still reserved | Old bug path; current code deducts inside Confirm — check deploy version |
| Double loyalty points | Should be blocked by order-id idempotency; inspect loyalty ledger |
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
