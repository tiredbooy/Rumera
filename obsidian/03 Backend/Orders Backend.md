---
tags: [backend, orders, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Orders Backend

Checkout order creation and lifecycle (customer list/cancel, admin status).

## Package (feature slice)

```text
apps/backend/internal/features/orders/
  doc.go → routes.go → handler.go → service.go
  → repository.go → item_repository.go → model.go → mapper.go
```

| Surface | Paths |
|---------|--------|
| Customer | `POST/GET /orders`, `GET /orders/:id`, `POST /orders/:id/pay`, `POST /orders/:id/cancel` |
| Admin | `GET /admin/orders`, status patch, `POST /admin/orders/:id/cancel`, `POST /admin/orders/:id/refund` |

**Idempotency (PH-011):** `POST /orders` and `POST /orders/:id/pay` mount money middleware. Send
`Idempotency-Key` once per checkout / pay intent for replay-safe retries (optional until
FE RequireKey flip). See [[ADR Idempotency platform]] · [[Playbook Debug Idempotency]].

## Gift add-ons (PH-060)

- CreateOrder accepts `is_gift` + `gift_option_ids[]` (server-priced against [[Site Settings]] `gift` group)
- Snapshot: `gift_addons` JSONB + `gift_addons_fee`; included in generated `total_amount`
- Tax (PR-020p): `TaxRate` 0.08 applies to post-discount merchandise **plus** `gift_addons_fee` (IR VAT-style on the paid add-on); shipping is not taxed. Rate is not admin-editable. Generated total = `subtotal − discount + shipping + tax + gift_addons_fee`.
- Legacy `gift_wrap=true` maps to option id `gift_wrap` when present
- Errors: `GIFT_DISABLED`, `INVALID_GIFT_OPTION`
- Migration: `20260812180000_order_gift_addons.sql`

Downward deps: cart, coupons, shipping, addresses, inventory, payments, wallet (`WalletPurchaser.PurchaseTx` on wallet checkout — PR-020a; `WalletRefunder` / `*wallet.Service.Refund` on admin refund — PR-020d), site_settings (gift config), loyalty (`orderEarnClawback` on `POST /admin/orders/:id/refund`; nil-safe).

**Admin refund (PR-020d):** `POST /admin/orders/:id/refund` on the existing write group (`orders:write` or `orders:refund`). Paid-like only (`paid` / `processing` / `ready_to_ship` / `shipped` / `delivered`). Wallet rail credits via `wallet.Refund`; then `inventory.AdjustStock` type `refund` per line; then `ClawbackOrderEarn`; then status `refunded`. Already `refunded` → `409`, no second wallet credit. Non-wallet tenders: restock + clawback + status only — **no PSP refund** (operator/manual money return). Coupons are **not** restored on refund. PATCH `refunded` / `partially_refunded` / `refund_approved` / `refund_requested` is rejected (`409 INVALID_STATE` — use the POST). No `refunded_at` column.

**Cancel (PR-020j):** customer `POST /orders/:id/cancel` and admin `POST /admin/orders/:id/cancel` share one path. `pending` / `payment_failed` only. **One TX:** CAS `cancelled` + `DeleteByOrderTx` (coupon usage reverse) + `ReleaseForOrderTx`. Release errors roll the TX back (not swallowed). Already cancelled → `409 ORDER_CANCELLED`; paid-like → `409 ORDER_ALREADY_PAID`; missing / not owned → `404`. TTL expire does **not** reverse coupons (`payment_failed` may still pay).

**Status machine (PR-020l):** `PATCH /admin/orders/:id/status` is warehouse-only. Graph: `paid` → `processing` → `ready_to_ship` | `shipped` → `out_for_delivery` | `delivered`; `ready_to_ship` → `shipped`; `out_for_delivery` → `delivered`. Unpaid cannot enter fulfilment via PATCH. `paid` / `cancelled` / refund-family are **not** PATCH targets — `MarkAsPaid`, `POST /orders/:id/cancel` / `POST /admin/orders/:id/cancel`, `POST /admin/orders/:id/refund`. Illegal jump → `409 INVALID_STATE`. PATCH `item_count` is `len(GetItems)`.

**Parcel tracking (PR-020r):** optional nullable `tracking_number` / `parcel_carrier` on `orders`. PATCH may set them only when moving to `shipped` or `out_for_delivery`. Not a TMS. Not the shipping-method rate `carrier`. Refund/cancel money paths unchanged.

Wallet `POST /orders` settles in the create TX (debit + paid + deduct). Response `status=paid`. Other rails insert a pending payment **in the same TX** (fail-closed) and return `{payment_id, transaction_id, payment_url}` (PR-020f). After webhook fail, owner `POST /orders/:id/pay` opens a new intent (or returns the existing pending). Wallet pay-again is refused.

**Receipt (PR-020o):** unpaid `POST /orders` does **not** email “order confirmed”. `orders.ReceiptSender` fires after **paid** — wallet-paid create, or [[Payments Backend]] `Confirm`. Copy is paid/confirmed, not “being processed”. Send is best-effort (does not undo money). Dispatcher idempotency `order:{id}:confirm`.

**Currency (PR-020g):** new checkout `payment_transactions` settle in **IRT** (`orders.defaultCurrency`), same as wallet/gift intents and the table default — not `USD`. Multi-currency is deferred ([[Money and stock rules]] · [[Term Toman]]).

**Ship-to snapshot (PR-020i):** create freezes name / phone / lines / city / province / postal / country on `orders.ship_to` (plus method name/carrier and coupon code). `address_id` stays `ON DELETE SET NULL`. Customer + admin GET return `user` (safe fields), `address` / `ship_to`, `shipping_method`, `coupon` / `coupon_code`, and `payment` when a gateway intent is already attached. Live address edits after place do not change fulfillment.

Payments avoid importing this package (cycle): they call `Repository.MarkAsPaid` +
`GetStockLines` via a small interface. Inventory uses `inventory.StockLine`.
`GetStockLines` returns VariantID ascending (PR-020k) so deduct/release lock
order matches [[Money and stock rules]]. It reads `order_items` only (no
`products` join) so a deleted product still releases/deducts (PR-020m).

`models.PaymentMethod` stays shared in `models/payment_method.go`.

## Related

[[Orders]] · [[Cart and Checkout]] · [[Payments Backend]] · [[Inventory Backend]] · [[ADR Backend feature packages]]

#backend #orders
