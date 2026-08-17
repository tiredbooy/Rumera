# Inventory architecture

**Who this is for:** engineers changing stock numbers, order fulfillment, admin
inventory UI, or debugging oversell / “paid but stock wrong.”

**API contract (endpoints, filters, JSON shapes):** [api/inventory.md](../api/inventory.md)  
**Payments coupling:** [payments-and-webhooks.md](./payments-and-webhooks.md)  
**Frontend admin UI:** [features/inventory.md](../../../frontend/docs/features/inventory.md)

---

## Why inventory exists

Rumera sells physical bottles. Stock must answer three questions at once:

1. **How many units sit in the warehouse?** (`stock_on_hand`)
2. **How many are promised to unpaid/open orders?** (`committed_stock`)
3. **How many can a customer still buy?** (`available_stock`)

Those are not three independent knobs. The system treats them as a small
state machine driven by **orders**, **payment webhooks**, and **admin
adjustments**, with an append-only **movement ledger** for audit.

---

## Core quantities

| Field | Meaning | Who changes it |
|-------|---------|----------------|
| `stock_on_hand` | Physical units in the warehouse | Restock, purchase out, damage, adjustment, **deduct on paid order** |
| `committed_stock` | Units reserved for orders not yet deducted | **Reserve** on place order, **release** on cancel/fail pay, **deduct** clears commitment |
| `available_stock` | **Derived:** `stock_on_hand - committed_stock` | Never stored as a free-form write from the client; computed for API responses |
| `reorder_point` | Threshold for “low stock” alerts | Admin `PATCH …/reorder` |
| `reorder_quantity` | Suggested replenishment size (planning) | Admin reorder patch |

**Invariant you must preserve:**

```
available_stock = stock_on_hand - committed_stock
available_stock >= 0
committed_stock >= 0
stock_on_hand >= committed_stock   (after consistent ops)
```

Catalogue and cart **sellable quantity** must use **available**, never raw
on-hand alone. Otherwise two customers can buy the same reserved bottle.

---

## Lifecycle (order path)

```
                    stock_on_hand     committed     available
Place order         unchanged        +qty          −qty
  Reserve ─────────────────────────────────────────────────►

Payment failed or   unchanged        −qty          +qty
order cancelled
  Release ─────────────────────────────────────────────────►

Payment succeeded   −qty             −qty          unchanged*
  Deduct  ─────────────────────────────────────────────────►
  (*available stays same because both sides drop by qty)
```

### Per-order reservation identity (PR-020b)

`committed_stock` is still the sellable counter. Identity lives in
`inventory_reservations` (unique `(order_id, product_variant_id)`, status
`active` / `released` / `deducted`).

- **Reserve** inserts or reactivates **this** order’s row, then
  `committed_stock += qty`. Already-active same qty is a no-op.
- **Release** succeeds only while the row is **active**; then decrements
  committed and marks `released`. Re-release is a no-op (does not steal
  another order’s committed units).
- **Deduct** succeeds only while the row is **active**; then decrements
  on-hand + committed and marks `deducted`. Late success after fail/release
  must not drain a foreign committed pool.

Migration `20260816190000_inventory_order_reservations.sql` backfills
active rows for in-flight `pending` orders.

### 1. Reserve — place order

- **Caller:** `OrderService.CreateOrder` via `ReserveForOrderTx` on the **same
  Postgres transaction** as order + line items + coupon usage.
- **Effect:** move qty from available → committed (`committed_stock += qty`).
  Physical `stock_on_hand` does **not** change yet.
- **Atomicity:** if any line is short, the **entire** order transaction rolls
  back. No dangling pending order without stock.
- **Error:** `ErrInsufficientStock` → client sees conflict / unprocessable
  (handler mapping). `isBusinessError` uses `errors.Is` (PR-020q) so a `%w`-wrapped sentinel stays business, not a 500.

Code: `internal/features/inventory/service.go` → `ReserveForOrderTx`  
Also used when tests call standalone `ReserveForOrder` (own short tx).

### 2. Release — unpaid cancel / payment failed

- **Caller:** order cancel path; payment webhook `failed` branch after
  `PaymentService.Fail` + pending→`payment_failed`.
- **Effect:** `committed_stock −= qty` (available goes back up). Physical stock
  unchanged. Only this order’s **active** reservation is released.
- **Why:** the warehouse never shipped; the hold is lifted.

### 3. Deduct — payment confirmed

- **Caller:** `PaymentService.Confirm` via `DeductForOrderTx` on the **same
  transaction** as “payment succeeded” + “order paid”.
- **Effect:** reduce **both** `stock_on_hand` and `committed_stock` by qty
  (units leave the building conceptually and leave the hold).
- **Why atomic with Confirm:** a paid order must never leave stock still only
  “committed” forever (historical bug class).
- **Fail-closed:** no active reservation → deduct refused. `MarkAsPaid` is
  still pending-only, so `payment_failed` orders cannot be marked paid.

See payments doc for webhook HMAC and idempotency of status transitions.

---

## Every variant has an inventory row

Missing inventory rows used to 404 admin detail/adjust for brand-new variants.
That is no longer acceptable.

| Path | Behavior |
|------|----------|
| `VariantService.Create` | `EnsureForVariant` after insert (own short TX) |
| Editor `SaveAggregate` (`POST/PUT …/aggregate`) | `inventory.EnsureForVariantTx` in the **same TX** after every variant insert/update |
| Legacy `POST /admin/products` inline variants (`insertVariantTx`) | `EnsureForVariantTx` in the **same TX** after each new variant |
| `GetByVariantID` / `AdjustStock` / `UpdateReorder` | ensure (or ensure-in-tx) before use |
| Migration `20260804170000_ensure_inventory_for_all_variants` | backfill zero-stock rows for existing variants |
| Seed | inserts starting stock per product |

`EnsureForVariant` / `EnsureForVariantTx` are idempotent (`INSERT … ON CONFLICT
DO NOTHING` style / exists-check). Zero on-hand is correct — do not invent
stock. If ensure fails, the variant write must not commit (editor/legacy create
share the product TX). If the **variant** itself is missing → `apperr.ErrNotFound`
on the standalone path; in-TX callers surface the repo error and roll back.

List (`GetAll`) still reads from the `inventory` table; after migration + create
ensure, every sellable variant appears. Missing row ⇒ not purchasable
(`purchasable_variant_id` stays null) and admin stock tools miss the variant.

---

## Admin operations

Admin HTTP is the only **direct** stock write surface (staff JWT + inventory
permissions). Customers never call these routes.

| Operation | Service method | Movement types (typical) |
|-----------|----------------|---------------------------|
| List / filter / sort | `GetAll` | — |
| Low stock list | `GetLowStock` | — (`available <= reorder_point`) |
| Variant detail | `GetByVariantID` | — (auto-ensure zero row) |
| Adjust stock | `AdjustStock` | `restock`, `purchase`, `refund`, `adjustment`, `damage` |
| Reorder thresholds | `UpdateReorder` | — (auto-ensure) |
| Movement ledger | `GetMovements` / `GetMovementsByVariant` | all types including reservation/release |

### Adjustment validation (`validInventoryAdjustment`)

| Type | Quantity rule |
|------|----------------|
| `adjustment` | non-zero (signed delta) |
| `restock`, `refund` | **positive** only |
| `purchase`, `damage` | **negative** only |
| `reservation`, `release` | **not** accepted on admin adjust API (order lifecycle owns them) |

Invalid requests → `ErrInvalidInventoryAdjustment`.  
Insufficient physical stock for a negative delta → `ErrInsufficientStock` and
transaction rollback.

Adjustments run in their own short transaction and write a **movement** row
(ledger). Order-linked movements can carry `reference_order_id` / `order_id`
filters on the ledger list API.

### Reorder points

`PATCH /admin/inventory/variants/:variantID/reorder` updates planning fields
only. It does not move stock. Low-stock endpoints and the admin dashboard
stats use `available_stock <= reorder_point`.

---

## Movement ledger

Every meaningful stock change should be reconstructible from movements.

| Type | Typical source |
|------|----------------|
| `reservation` | Place order |
| `release` | Cancel / payment fail |
| *(deduct may log as related type depending on repo impl)* | Payment confirm |
| `restock` | Receiving goods |
| `purchase` | Outbound non-order / COGS style negative |
| `refund` | Units returned to sellable stock |
| `damage` | Write-off |
| `adjustment` | Manual correction |

Admin list filters: variant, type, order id, pagination. See API doc for JSON.

---

## Code map

| Layer | Path |
|-------|------|
| Feature package | `internal/features/inventory/` |
| Handler | `internal/features/inventory/handler.go` |
| Service | `internal/features/inventory/service.go` |
| Repository | `internal/features/inventory/repository.go` (+ `reservation.go`, `movement_repository.go`) |
| Domain + wire types | `internal/features/inventory/model.go` (+ `mapper.go`) |
| Shared sentinels | `internal/models/errors.go` (`ErrInsufficientStock`, `ErrInvalidInventoryAdjustment`, …) |
| Unit tests | `internal/features/inventory/service_test.go`, `reservation_test.go` |
| Integration | `tests/integration/inventory_test.go` |

**Dependency direction:** Order and Payment feature services call inventory
service APIs. Inventory does not import HTTP handlers. Repositories own the SQL
that updates counters under row locks (preventing lost updates under concurrency).

Domain entities live in the feature package — not in `internal/models` (PH-012a).

---

## Concurrency and oversell

| Risk | Mitigation |
|------|------------|
| Two checkouts same last unit | Reserve inside order TX with conditional SQL (insufficient → error + rollback) |
| Order committed without stock | Reserve is **in** CreateOrder TX |
| Paid without physical drop | Deduct **in** Confirm TX |
| Double webhook | Payment status transitions only from pending; confirm/fail not re-applied |
| Fail then late succeed | Order → `payment_failed`; deduct requires **this** order’s active reservation (PR-020b) |

Integration tests exercise reservation visibility to cart/wishlist and
adjustment thresholds — run with `make test-integration` when
`TEST_DATABASE_URL` is set.

---

## How catalogue reads stock

Public product lists expose `available_stock`, the sum of sellable stock across
active variants after committed units are subtracted, plus related counts such
as `available_variant_count`. Product detail exposes the same sellable quantity
per variant. Frontend presentation must treat zero available as out-of-stock,
not guess from `stock_on_hand`; product cards disclose the aggregate count only
when it is below the storefront threshold.

Wishlist/cart should not treat committed units as free stock (integration
coverage: committed unavailable to cart/wishlist).

---

## Operator runbook (short)

| Symptom | Check |
|---------|--------|
| Customer cannot buy, warehouse full | High `committed_stock` — stuck pending orders? release or cancel |
| Oversell reports | Confirm reserve still in CreateOrder TX on deployed build |
| Paid, stock not down | Confirm deduct inside Payment Confirm; webhook success path |
| Low-stock empty but shelves bare | Reorder points too low; or looking at on-hand not available |
| Adjust rejected | Wrong sign for movement type (see table above) |

---

## Related reading

1. [API inventory](../api/inventory.md) — exact routes and payloads  
2. [Payments & webhooks](./payments-and-webhooks.md) — when deduct/release fire  
3. [Processes & jobs](./processes-and-jobs.md) — no separate inventory worker today  
4. Frontend [inventory feature guide](../../../frontend/docs/features/inventory.md)  
5. [Testing](../../../../docs/TESTING.md) — unit + integration commands  
