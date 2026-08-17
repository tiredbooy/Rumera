---
tags: [architecture, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Money and stock rules

Non-negotiable invariants. Full saga narrative (mermaid + packages):

**Repo:** `apps/backend/docs/architecture/money-and-stock-sagas.md`

## Money

1. Server is authority for totals, discounts, shipping quotes.
2. Prefer decimal **strings** on the wire; don’t round-trip money through JS float for storage.
3. Display: `formatPrice` / `faNum` · currency often IRT / [[Term Toman]].
4. Loyalty earn only after **paid** order ([[Payments Backend]]). Confirm retries earn from `payment_loyalty_awards`; payment does not roll back if points fail. Receipt email is the same rule (PR-020o): after Confirm or wallet-paid create — not unpaid `POST /orders`.
5. **No free money** — admin wallet credit is gated + idempotent; customer top-up = gateway (PH-041a).
6. Webhooks are at-least-once → idempotency + unique gateway tx id.  
   **Design:** [[ADR Idempotency platform]] · journey [[Journey Idempotent retry checkout webhook]] ·  
   playbook [[Playbook Debug Idempotency]] ·  
   repo `apps/backend/docs/architecture/idempotency.md` + `idempotency-runbook.md`
7. Gateway intents include `payment_url` = `{PAYMENT_START_BASE_URL}?transaction_id=` ([[Payments Backend]] · [[Journey Account wallet top-up]]). Empty URL (dev, env unset) is **not** a successful pay. Production requires the env (PR-005a).
8. Gift-card paid fulfill emails the code on a **new** issue only (PR-005b). Replay does not re-send. Email failure does not roll back the card — [[Journey Gift card purchase]] · [[Playbook Debug Webhook]].
9. **Tax** — `TaxRate` 0.08 applies to post-discount merchandise plus selected gift add-on fees (IR VAT-style on the paid add-on). Shipping is excluded. Rate is not admin-editable (PR-020p).
10. Warehouse `PATCH` may record optional parcel tracking on ship / out_for_delivery (PR-020r); it does not move money or stock.

## Stock

1. Sellable = [[Term available_stock]], never on-hand alone.
2. Place order **reserves** in same TX as order ([[Inventory Backend]]).
3. Payment success **deducts** in same TX as mark paid. `MarkAsPaid` stamps `paid_at` once (PR-020h) so [[Orders]] `paid_from` / `paid_to` include webhook-paid rows ([[Payments]] · [[Playbook Debug Webhook]]). Wallet checkout (`payment_method=wallet`) debit + mark paid + deduct on `POST /orders` itself (PR-020a · [[Wallet Backend]]). Shortfall is `INSUFFICIENT_FUNDS` — no pending order, no committed stock.
4. Payment fail / cancel **releases** commitment. Fail sets order `payment_failed` (pending-only). Customer/admin cancel is **one TX**: cancelled + coupon usage reverse + release (PR-020j). Release/deduct require **this** order’s active `inventory_reservations` row (PR-020b) so a late succeed cannot deduct another checkout’s committed units.
5. Admin adjust cannot use reservation/release types (system-owned).
6. Reserve / release / deduct lines **sorted by variant id** — [[Orders Backend]] `GetStockLines` returns VariantID ascending (PR-020k) so webhook deduct/release inherit lock order ([[Inventory]] · [[Playbook Debug Oversell]]).

## Sagas (names)

| Saga | Story |
|------|--------|
| A | Happy checkout → webhook succeed → deduct → loyalty |
| A-wallet | Wallet `POST /orders` debit + paid + deduct in one TX (PR-020a) |
| B | Webhook fail → release |
| B2 | Unpaid cancel → cancelled + coupon reverse + release in one TX (PR-020j) |
| C | Coupon FOR UPDATE under order TX |
| D | Admin wallet credit |
| E | Gift card redeem |
| F | Webhook / client retry (PH-011 hardening) |

## Related journeys

[[Journey First purchase]] · [[Journey Payment webhook settle]] · [[Journey Account wallet redeem]] · [[Journey Account wallet top-up]] · [[Journey Gift card purchase]] · [[Journey Idempotent retry checkout webhook]] · [[Playbook Debug Oversell]] · [[Playbook Debug Webhook]] · [[Playbook Debug Idempotency]] · [[Playbook Document a change]]

Related: [[Inventory]] · [[Payments]] · [[Orders]] · [[Cart and Checkout]] · [[Wallet Backend]] · [[Loyalty Backend]] · [[ADR Stock available not on-hand]] · [[ADR Order reserve and pay deduct atomic]] · [[Layered Backend]]

#architecture #commerce
