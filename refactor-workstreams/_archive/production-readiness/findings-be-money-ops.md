# Findings — `be-money-ops`

**Agent:** be-money-ops  
**Workstream:** `production-readiness-20260816`  
**Date:** 2026-08-16  
**Mode:** investigation only (no application code)

Whole-project backend money/ops audit: orders, payments + webhooks, inventory, shipping, coupons, checkout/create-order saga, order status, refunds. Do **not** reopen PH-000…060, BE-000…044, Refactor-Docs, or already-claimed PR-001…011 / PR-003c–m / PR-005a–c / PR-010a–g unless a **new** live bug is shown.

---

## What I inspected

| Area | Paths |
|------|--------|
| Orders | `apps/backend/internal/features/orders/` (`routes`, `handler`, `service`, `repository`, `item_repository`, `model`, `mapper`, `gift_options`) |
| Payments | `apps/backend/internal/features/payments/` (`routes`, `handler`, `service`, `repository`, `webhook`, `model`) |
| Inventory | `apps/backend/internal/features/inventory/` (`service`, `repository`, `handler`, `movement_repository`) |
| Shipping | `apps/backend/internal/features/shipping/` (`service`, `handler`, `zone_repository`) |
| Coupons | `apps/backend/internal/features/coupons/` (`service`, `handler`, `usage_repository`, `mapper`) |
| Adjacent | `wallet.Purchase` / `Refund` (unused from orders), `giftcard` (wallet redeem only — not checkout tender) |
| Routes / cron | `internal/routes/routes.go`, `internal/bootstrap/container.go`, `internal/corn/` (no reservation TTL job) |
| Docs | `docs/architecture/money-and-stock-sagas.md`, `payments-and-webhooks.md`, `api/orders.md`, `api/payments.md` |
| FE contracts (read-only) | `features/checkout/components/checkout-flow.tsx`, `checkout-payment-step.tsx`, `add-address-form.tsx`, `order-confirmation-view.tsx`, `admin/orders/OrderActions.tsx` |
| Historical | `docs/IMPROVEMENT-OPPORTUNITIES.md` money rows 5.1 / 5.3 / 5.4 / 5.5 / 6.4 |
| Schema | `migrations/main/20260526174539_create_orders.sql`, `…74550_create_payment_transactions.sql`, `…74542_create_coupon_usages.sql`, `20260812180000_order_gift_addons.sql` |

---

## What is actually solid (do not redo)

Place-order **atomicity** is real: one TX for order + items + coupon usage under `FOR UPDATE` + `ReserveForOrderTx` (`orders/service.go:192–287`). Short stock rolls the whole order back.

Payment **success** is also one TX: `Confirm` + `MarkAsPaid` + `DeductForOrderTx` (`payments/service.go:240–306`). Confirm is pending-only; webhook terminal replay ACKs 200 (`webhook.go:107–120`). `transaction_id` UNIQUE is live (PH-011d).

Inventory **Adjust** now checks `RowsAffected` and does **not** insert a phantom movement (`inventory/repository.go:311–319`). Historical **5.4 is closed**.

Domain errors on inventory/orders go through `httpx.HandleError` (`platform/httpx/errors.go:12–56`) with `errors.Is`. Historical **5.3 is closed** for this lane.

Checkout **weight** is summed from cart (`orders/service.go:133–142`). Historical **5.1 / PH-020c stays closed**.

Coupon TOCTOU on max-uses is closed (`revalidateCouponUnderLock`, `orders/service.go:362–401`).

Shipping quote and persist share `CalculateShippingCost` / `AuthorizeCheckoutMethod` (`shipping/service.go:305–372`).

Customer cancel is ownership-scoped and limited to `pending` / `payment_failed` (`orders/repository.go:265–280`).

---

## Mounted surface (nothing else)

### Customer

| Method | Path | Body / query | Success |
|--------|------|--------------|---------|
| POST | `/orders` | `CreateOrderReq` + optional `Idempotency-Key` | `201 {data: OrderResponse}` — **no payment** |
| GET | `/orders` | page/limit/status/paid_from/paid_to | `{results, pagination}` of `OrderListItem` |
| GET | `/orders/:id` | — | `OrderResponse` |
| POST | `/orders/:id/cancel` | — | `204` |
| POST | `/coupons/validate` | `{code, order_subtotal, product_ids?, category_ids?}` | `CouponValidationResult` |

### Public

| Method | Path | Notes |
|--------|------|--------|
| POST | `/webhooks/payment` | HMAC `X-Webhook-Signature`; `status` = `succeeded` \| `failed` |
| GET | `/shipping/available` | `region`, `weight`, `subtotal` |
| GET | `/shipping/zones`… | catalogue |

### Admin

| Method | Path | Capability |
|--------|------|------------|
| GET | `/admin/orders`, `/admin/orders/:id` | `orders:read` or write/refund |
| PATCH | `/admin/orders/:id/status` | `orders:write` **or** `orders:refund` — **same handler** |
| GET | `/admin/payments`… | `payments:read` only |
| CRUD | `/admin/coupons`, `/admin/shipping/*` | manage caps |
| GET/POST/PATCH | `/admin/inventory`… | read/write split |

`payments.RegisterCustomer` is a **no-op** (`payments/routes.go:18–19`). There is **no** customer pay, pay-again, refund-request, or admin refund route.

---

## Live production holes (new)

### P0 — Wallet checkout does not take money

FE default and first rail is `wallet` (`checkout-flow.tsx:58`, `checkout-payment-step.tsx:19–27`).

`POST /orders` accepts `payment_method=wallet` (`orders/model.go:73`) then after commit calls `createPendingPayment` (`orders/service.go:289–328`). That inserts a **pending** `payment_transactions` row. It never calls `wallet.Purchase` (`wallet/service.go:252–297`), never marks the order paid, never deducts stock.

Result: customer sees confirmation “سفارش تأیید شد” (`order-confirmation-view.tsx:65–69`) with status **pending**, stock **committed**, wallet **unchanged**. The only way that wallet order becomes paid is a forged/manual webhook `succeeded` for the hidden `transaction_id` (which the client never receives).

`wallet.Purchase` / `wallet.Refund` exist and are unit-tested; they are not on the checkout path.

**Propose PR-020a.** Distinct from PR-005a (`payment_url` for *gateway* intents).

### P0 — Failed webhook + late success can steal another order’s committed stock

`committed_stock` is a **counter**, not a per-order reservation (`inventory/repository.go:322–401`). Deduct/Release only require global `committed_stock >= qty`.

Webhook `failed` (`payments/webhook.go:79–97`):

1. Marks payment `failed` (pending-only).
2. **Releases** the reservation.
3. **Does not** set order `payment_failed` — order stays `pending` (`MarkAsPaid` still accepts it).

Then another checkout can reserve the same units. A late `succeeded` for order A runs `DeductForOrderTx` against whoever’s committed pool and marks A paid.

Architecture already said “Release must not be discarded silently” (`money-and-stock-sagas.md:73–74`); the handler still does `_ = h.Inventory.ReleaseForOrder`.

**Propose PR-020b** (bind reservation to order + fail must flip order status + do not deduct foreign committed).

### P0 — Abandoned pending orders hold stock forever

No cron/job expires unpaid reservations (`bootstrap/container.go` jobs: stats, recs, idempotency, alerts, subscription email, meili, birthday — **no** reservation TTL). If the webhook never arrives (or `createPendingPayment` never ran), `committed_stock` stays up until a human cancels.

Combined with wallet/bank_transfer (no gateway), this is the default path.

**Propose PR-020c.**

### P0 — Operator cannot refund money or restock

Statuses include `refund_requested` / `refund_approved` / `refunded` / `partially_refunded` (`orders/model.go:20–23`). `PATCH /admin/orders/:id/status` only writes the column (+ timestamps for a few values) (`orders/repository.go:221–262`). `UpdateOrderStatus` has **zero** side effects (`orders/service.go:509–515`).

- No gateway refund.
- `wallet.Refund` never called.
- No inventory `MovementTypeRefund` from this path.
- Loyalty `ClawbackOrderEarn` still unused (already PR-003i — **do not duplicate**; refund saga must *call* it).

`orders:refund` is OR’d onto the same PATCH as write (`routes.go:237–240`). Admin UI is a full-enum `<Select>` (`OrderActions.tsx:21–69`). Setting `refunded` is a green toast and a lie.

Analytics still reads `payload.refund_amount` from `order_created` events (`corn/revenue_job.go:73–89`) — CreateOrder handler never sets that key (`orders/handler.go:74–81`), so refunds_total stays 0 even after a fake status flip.

**Propose PR-020d** (real refund command). Not a PH rewrite; the status enum was always a label.

### P0 — Checkout shipping region cannot match operator zones

CreateOrder region = `strings.ToUpper(address.Country)` (`orders/service.go:153–156`). Checkout new addresses hardcode `country: "IR"` (`add-address-form.tsx:41`). Quotes use the same (`checkout-flow.tsx:129–136`).

Zones match **exact** `region_codes @> ARRAY[$1]` (`shipping/zone_repository.go:146–150`). Admin FE + integration tests use **`IR-TEH`** (`shipping_test.go:29`, `shipping-zone-form` chips).

If staff configure Tehran as documented, `GET /shipping/available?region=IR` returns `[]` and `POST /orders` is `422 INVALID_SHIPPING`. Selling stops.

**Propose PR-020e** (contract: province on address **and/or** zone country fallback).

### P1 — Place order does not return a payable intent; pay-again does not exist

`createPendingPayment` is best-effort and **swallows all errors** (`orders/service.go:312–328`). `OrderResponse` has no `payment_id` / `transaction_id` / `payment_url` (`orders/model.go:123–148`, `mapper.go:5–32`).

If the insert fails: durable pending order + reserved stock + **no** payment row. Client cannot pay. `Create` also refuses a second pending row per order (`payments/service.go:83–94`). After webhook `failed`, there is still no `POST /orders/:id/pay`.

PR-005a covers adding `payment_url` to gateway intents. **This** is the order-side attach + retry + fail-closed create. **Propose PR-020f.**

### P1 — Checkout currency is `USD` against an `IRT` table default

`orders/service.go:27–29` `defaultCurrency = "USD"`. Wallet/gift intents use `"IRT"` (`payments/service.go:155`). Table default is `IRT` (`20260526174550_create_payment_transactions.sql:7`). Architecture: “Multi-currency — Not now — Toman” (`money-and-stock-sagas.md:144`). Admin payments docs show USD examples.

**Propose PR-020g.**

### P1 — `MarkAsPaid` never sets `orders.paid_at`

```349:355:apps/backend/internal/features/orders/repository.go
	UPDATE orders
	SET status     = 'paid',
	    updated_at = NOW()
	WHERE id     = $1
	  AND status = 'pending'
```

Webhook-paid orders stay `paid_at IS NULL`. Admin `paid` via PATCH *does* set it (`repository.go:228–231`). Customer/admin `paid_from` / `paid_to` filters miss real paid orders (`repository.go:151–157`).

**Propose PR-020h.**

### P1 — Order payload is not fulfillable

`OrderResponse` omits `user_id`, `address_id`, ship-to snapshot, `shipping_method_id`, `coupon_id`, payment status/txid (`orders/model.go:123–148`). `address_id` is `ON DELETE SET NULL` (`20260526174539_create_orders.sql:29`). Customer can edit/delete the live address after place.

Admin detail (`order-detail-view.tsx`) can print lines and flip status. Warehouse has no name, phone, street, or city from this API.

**Propose PR-020i** (snapshot address + expose fulfillment fields on GET, admin at minimum).

### P1 — Admin `cancelled` / customer cancel leave money-adjacent leaks

Customer cancel: `Cancel` then `_ = ReleaseForOrder` (`orders/service.go:517–538`) — not one TX; release errors swallowed. Coupon usage row is **not** deleted (`usage_repository.go` has Record/Get only). Unpaid cancel still burns `MaxUses` / `MaxUsesPerUser`.

Admin PATCH `cancelled` sets `cancelled_at` only — **no** stock release.

Docs promise `409 ORDER_CANCELLED` / `ORDER_ALREADY_PAID` (`api/orders.md:186`). Repo returns `models.ErrNotFound` for every miss → **404**.

**Propose PR-020j.**

### P1 — Reservation lock order still unordered (5.5 **still live**)

`money-and-stock-sagas.md:132–136` requires sort by `variant_id` before row locks. `ReserveForOrderTx` / `Release` / `Deduct` iterate the caller slice (`inventory/service.go:224–305`). CreateOrder builds that slice in **cart order** (`orders/service.go:275–279`). Two checkouts with opposite line order can 40P01 mid-checkout.

**Propose PR-020k.** Historical IMPROVEMENT 5.5 — re-verified against current code.

### P1 — Status machine is a free write

Any of 13 statuses anytime (`UpdateOrderStatusReq` `oneof=…` at `orders/model.go:97`). Admin can mark `paid` without a payment (sets `paid_at`, does **not** deduct), or `delivered` from `pending`. `orders:refund` is not a distinct action.

**Propose PR-020l** (allowed transitions; paid/refunded/cancelled only via money/stock commands).

### P1 — Stock lines go through `GetItems` INNER JOIN products

`GetItems` (`orders/repository.go:283–295`) `INNER JOIN products`. `GetStockLines` wraps that (`337–346`). If a product row is gone, webhook deduct/release and cancel release **silently drop lines**. Use `order_items` only for stock.

**Propose PR-020m.**

### P1 — Coupon preview ≠ place for scoped coupons

`CouponAppliesToBasket` requires a matching product/category id (`coupons/mapper.go:109–129`). Checkout validate sends `{code, order_subtotal}` only (`checkout-flow.tsx:205`). Scoped coupons preview **invalid**; CreateOrder uses cart `ProductID` / `CategoryID` and can succeed. Or staff think the code is dead.

**Propose PR-020n** (validate against server cart when IDs omitted).

### P2 — Confirmation email on unpaid create

`sendOrderConfirmation` runs on `POST /orders` success (`handler.go:85–118`): “received and is now being processed.” Order is still pending. No email on actual paid.

**Propose PR-020o.**

### P2 — Tax / gift pricing

Tax = `(subtotal - discount) * 0.08` (`orders/service.go:223`, `models/tax.go:6`). Gift add-on fee is **not** in the tax base; it is in generated `total_amount` (`20260812180000_order_gift_addons.sql:12`). Hardcoded 8% is not admin-editable. Confirm whether IR VAT should apply to gift packaging.

**Propose PR-020p.**

### P2 — `isBusinessError` still uses `==` (6.4 residual)

`inventory/service.go:313–320`. Reserve currently returns unwrapped sentinels, so 409 still works. Any `%w` wrap on the miss path becomes a 500. Switch to `errors.Is`.

**Propose PR-020q.**

### P2 — No shipment tracking; PATCH status `item_count: 0`

No tracking/carrier columns. Shipping methods have `carrier` for the **rate**, not the parcel. Admin PATCH returns `ToOrderListItem(order, 0)` (`handler.go:238`).

**Propose PR-020r** (tracking optional) + include in 020l response fix.

### P2 — Unbounded admin lists

`GET /admin/inventory/low-stock` and `GET /admin/inventory/variants/:id/movements` have no pagination (`inventory/handler.go:45–56`, `141–156`). Fine at seed size; not operator-safe later.

**Propose PR-020s.**

### P2 — Bank transfer / card / crypto are labels

Accepted on `CreateOrderReq`. FE only offers wallet + bank_transfer. No IBAN/instructions API, no gateway client in this repo (webhook is the entire rail). Card/crypto cannot complete without an external signer who knows the hidden `transaction_id`. Fold operator bank-transfer copy into **PR-020f** / existing **PR-005a**; do not invent a new PSP integration here.

---

## IMPROVEMENT-OPPORTUNITIES money rows (re-verify)

| Row | Then | Now |
|-----|------|-----|
| 5.1 weight=0 | Open | **Closed** PH-020c — `packageWeightKg` in CreateOrder |
| 5.3 handleError 500 | Open | **Closed** for inventory/orders — `httpx.HandleError` + `errors.Is` |
| 5.4 phantom Adjust movement | Open | **Closed** — `RowsAffected` + classify miss |
| 5.5 unordered reserve deadlock | Open | **Still live** — PR-020k |
| 6.4 `isBusinessError` `==` | Open | **Still live** (latent) — PR-020q |
| Refund/returns incomplete (BACKEND-IMPROVEMENTS #18) | Open | **Still live** — PR-020d (new ID; not a PH reopen) |
| Reservation TTL | Mentioned as leak | **Still live** — PR-020c |
| Shipment tracking | Mentioned | **Still live** — PR-020r (P2) |

Do **not** copy stale 5.3/5.4 into TASKS.

---

## Explicit non-goals / already claimed

| Topic | Why not here |
|-------|----------------|
| `payment_url` on wallet/gift/checkout intents | **PR-005a** |
| Gift fulfill email | **PR-005b** |
| Subscription `address_id` | **PR-005c** |
| BFF `Idempotency-Key` | **PR-003c** |
| Loyalty clawback helper unused | **PR-003i** — refund saga must call it |
| Earn fire-and-forget after Confirm | **PR-003h** |
| `EnsureForVariant` on product aggregate | **PR-010a** |
| Cart UNIQUE / add-to-cart 500 | **PR-004a** |
| Tokenized box auto-charge | PH-043c closed |
| Building a real PSP SDK | Out of scope; webhook + wallet debit first |

---

## Proposed tasks (PR-020+)

| ID | Lane | Sev | Size | Why | Files |
|----|------|-----|------|-----|--------|
| **PR-020a** | be | P0 | M | Wallet checkout must debit + mark paid + deduct in **one TX**; reject insufficient funds before reserve commit | `orders/service.go`, `wallet/service.go`, `payments/service.go` |
| **PR-020b** | be | P0 | L | Per-order reservation identity; fail → `payment_failed` **without** leaving a stealable committed counter; late success must not deduct another order | `inventory/repository.go`, `payments/webhook.go`, `orders/repository.go` |
| **PR-020c** | be | P0 | M | TTL sweeper: expire unpaid pending, release stock, reverse coupon usage, fail dangling payment | `internal/corn/`, `orders/service.go`, `bootstrap/container.go` |
| **PR-020d** | be | P0 | L | Real refund command (`POST /admin/orders/:id/refund`): wallet/ledger + restock + coupon policy + call **PR-003i** clawback; stop treating PATCH status as refund | `orders/`, `wallet/`, `inventory/`, `payments/`, `routes.go` |
| **PR-020e** | both | P0 | M | Shipping region contract: address province vs `IR` vs `IR-TEH`; BE match + FE write | `shipping/`, `addresses/`, checkout add-address |
| **PR-020f** | be | P1 | M | Persist pending payment **in** create TX (or fail the order); return `{payment_id, transaction_id}` on `OrderResponse`; `POST /orders/:id/pay` after fail | `orders/service.go`, `orders/model.go`, `payments/service.go` |
| **PR-020g** | be | P1 | S | Checkout payments use `IRT` (match wallet/gift/table default); drop `USD` constant | `orders/service.go:27` |
| **PR-020h** | be | P1 | S | `MarkAsPaid` sets `paid_at` | `orders/repository.go:349–355` |
| **PR-020i** | be | P1 | M | Snapshot ship-to on create; admin/customer GET includes address, user, shipping method, coupon, payment summary | `orders/model.go`, `mapper.go`, `repository.go`, `handler.go` |
| **PR-020j** | be | P1 | M | Cancel + release + coupon usage reverse in one TX; admin cancel uses same path; map already-paid / already-cancelled to 409 as documented | `orders/service.go`, `coupons/usage_repository.go`, `httpx/errors.go` |
| **PR-020k** | be | P1 | S | Sort stock lines by `VariantID` in Reserve/Release/Deduct (5.5) | `inventory/service.go` |
| **PR-020l** | be | P1 | M | Allowed status transitions only; `paid`/`refunded`/`cancelled` only via money/stock commands; PATCH response `item_count` real; split `orders:refund` onto refund route | `orders/service.go`, `handler.go`, `routes.go` |
| **PR-020m** | be | P1 | S | `GetStockLines` from `order_items` only (no product join) | `orders/repository.go` |
| **PR-020n** | be | P1 | S | `POST /coupons/validate` loads caller cart when product/category IDs omitted | `coupons/handler.go`, `service.go` |
| **PR-020o** | be | P2 | S | Receipt email on **paid** (Confirm), not on pending create; copy must not say “processed” while unpaid | `orders/handler.go`, `payments/service.go` |
| **PR-020p** | be | P2 | S | Tax base includes gift fee **or** document 0% on add-ons; stop implying USD tax | `orders/service.go:223`, `models/tax.go` |
| **PR-020q** | be | P2 | S | `isBusinessError` → `errors.Is` (6.4) | `inventory/service.go:313–320` |
| **PR-020r** | be | P2 | M | Optional tracking/carrier on ship transition | `orders/` + migration |
| **PR-020s** | be | P2 | S | Paginate low-stock + variant movements | `inventory/handler.go`, `repository.go` |

Suggested implement order (when founder says go): **020e** (or FE zone=`IR`) so checkout can quote → **020a** wallet can complete a sale → **020h** + **020f** → **020b** + **020c** stock safety → **020d** + **020l** + **020j** operator money → rest.

---

## Contract snapshot for FE agents

`POST /orders` body (live):

```json
{
  "address_id": 1,
  "payment_method": "wallet|bank_transfer|card|crypto|gateway",
  "shipping_method_id": 1,
  "coupon_code": "optional",
  "is_gift": false,
  "gift_option_ids": [],
  "gift_message": null,
  "hide_price": false
}
```

`201 data` today: `OrderResponse` as in `orders/model.go:123–148`. **No** `transaction_id`. Status is **`pending`**.

`POST /coupons/validate` needs `product_ids` / `category_ids` for scoped codes, or wait for PR-020n.

`GET /shipping/available?region=IR` only matches zones that list **`IR`**, not `IR-TEH`.

Do not invent earn copy on unpaid checkout (already PR-003m / confirmation view is mostly correct on points).

---

No application code changed.
