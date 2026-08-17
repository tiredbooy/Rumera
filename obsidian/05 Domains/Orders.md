---
tags: [domain, commerce]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Orders

Lifecycle object from place-order through fulfillment.

## Create

Atomic TX: order + items + coupon usage + **inventory reserve**. Failure → nothing left.

`payment_method=wallet` also **debits** the wallet, **marks paid**, and **deducts** stock in that same TX (PR-020a · [[Wallet Backend]] · [[Money and stock rules]]). Response status is `paid`. Shortfall → `INSUFFICIENT_FUNDS`, nothing committed.

Send `Idempotency-Key` on place-order for safe client retries ([[ADR Idempotency platform]]).

Post-commit: clear cart (best-effort). Non-wallet rails persist the pending payment **inside** the create TX (or the order is not kept) and return `{payment_id, transaction_id, payment_url}` (PR-020f · [[Payments]]). Wallet does **not** create an unpaid payment row. After fail, owner `POST /orders/:id/pay`. Receipt email waits until **paid** (Confirm or wallet settle) — not unpaid create (PR-020o · [[Notifications]]).

## Read

- Customer: own orders only (`uid` scope) → [[Account FE]]
- Admin: list/detail/status + refund command → [[Admin Console]]
- Admin list filters (`status`, `paid_from` / `paid_to`, `user_id`) go on `GET /admin/orders` (PR-062c) — not a client facet of one page. `user_id` is the **internal** bigint. Customer list prints `total_orders` and only jumps here when that id is numeric (PR-064c) — the public UUID is not a valid filter ([[Customers Admin]]).
- Detail GET (customer + admin) includes ship-to snapshot, buyer identity (safe fields), shipping method, coupon code, and payment summary (PR-020i). Gift flag, message, add-on snapshot, buyer notes, and preferred delivery date are already on that DTO. Admin detail prints them when present (PR-062d · [[Admin Console]]). Fulfill from the snapshot — the live address book can change after place.

## Status & pay

Paid when [[Payments]] confirm succeeds **or** wallet checkout settles in create (PR-020a). `MarkAsPaid` stamps `paid_at` (PR-020h — [[Money and stock rules]]). Cancel before pay (`POST /orders/:id/cancel` or admin `POST /admin/orders/:id/cancel`) → one TX: cancelled + coupon reverse + stock release (PR-020j · [[Orders Backend]]).

Full refund is **`POST /admin/orders/:id/refund`** (PR-020d · [[Journey Admin refund restock]]): wallet credit when `payment_method=wallet`, restock (`AdjustStock` type `refund`), loyalty clawback ([[Loyalty Wallet Gift Cards]]), then status `refunded`. PATCH to `refunded` / other refund-family statuses is rejected — that path was a status-only lie. Non-wallet money return is operator/manual (no PSP). Coupon uses stay consumed on refund (unpaid cancel restores them — PR-020j). Already refunded → `409`, no double wallet credit.

Admin UI (`OrderActions` · [[Admin Console]] · PR-062b): warehouse dropdown only (PR-020l graph). Refund is a confirm button that POSTs the command — the dropdown never lists `refunded` / `cancelled` / `paid`.

Related: [[Cart and Checkout]] · [[Inventory]] · [[Payments Backend]] · [[Notifications]] · [[Journey First purchase]]

#domain #commerce
