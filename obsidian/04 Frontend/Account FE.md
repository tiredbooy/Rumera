---
tags:
  - frontend
  - account
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Account FE

`/account/*` — `requireUser`, force-dynamic, noindex, [[Account FE|AccountShell]].

Nav: orders, addresses, wishlist, taste, rewards, subscriptions, wallet, reviews, settings.

Hooks call [[BFF Proxies]] store APIs for [[Loyalty Wallet Gift Cards]], etc.

Views live under `features/account/<surface>/components`. Domain `api` / `types` / `validations` stay in `features/<domain>/` — empty account-local shells were deleted (PR-035d).

## Orders list tabs (PR-033a)

`/account/orders` sends `status` on `GET /orders`. Multi-status tabs
(processing, shipped, cancelled) fire one request per mapped status and merge
those server pages. Empty and error stay distinct.

## Order detail cancel + pay (PR-033b)

`/account/orders/:id` confirms cancel with AlertDialog (no fire-on-click).
`pending` / `payment_failed` show «ادامه پرداخت» / «پرداخت مجدد» via
`POST /orders/:id/pay`. Redirect only when the API `payment_url` is non-empty;
never invent a start URL. Wallet unpaid orders cannot start a gateway pay —
honest note, no CTA. No fake invoice/tracking (6.22).

## Overview prefetch (PR-032a)

`/account` RSC prefetches the six overview queries (orders, addresses, wallet,
loyalty, taste, for-you) with the same TanStack keys the client hooks use, then
hydrates via `HydrationBoundary`. Failed prefetches stay off the dehydrated
payload so KPI cards still retry independently.

Details: `apps/frontend/docs/platform/data-fetching.md`

## Loyalty UX (PH-040c)

- `/account/rewards` — balance, how-to-earn, ledger reasons FA, redeem + Idempotency-Key
- Review submit toast when `verified_purchase` — earn transparency
- Order confirmation — points only after paid; link to rewards
- Details: [[Loyalty FE]] · `apps/frontend/docs/features/loyalty.md`

## Wallet UX (PH-041b)

- `/account/wallet` — gateway top-up form + gift redeem; no free deposit
- Pending top-up / gift purchase shows `transaction_id`; «پرداخت در درگاه» only when API `payment_url` is non-empty (PR-030c); refresh after payment
- Docs: `apps/frontend/docs/features/wallet.md` · [[Journey Account wallet top-up]] · [[Journey Gift card purchase]]

## Wallet ledger (PR-035c)

`/account/wallet` sends `page` + `limit` on `GET /wallet/transactions`. The
table pages from the server envelope (`total_items` / `total_pages`). Month
credit/spend KPIs are only the loaded page and are labeled as that window
(«این صفحه» or «صفحهٔ N از M»). Date/direction filters still exist but apply
to the current server page — they are not a full-ledger query.

## Subscriptions (PR-035b)

`/account/subscriptions` — cellar box, not Netflix entitlements. Create still
picks optional `address_id`. Active / paused cards reuse `useAddresses()` and
PATCH `{ address_id }` to set/change ship-to. Cancelled is read-only. Missing
ship-to stays amber «آدرسی به این باکس وصل نیست».

Related: [[Account Domain]] · [[Auth and Sessions]] · [[Payments]] · [[Loyalty Backend]] · [[Wallet Backend]] · [[Subscriptions]] · [[Journey Manage cellar box]] · [[Playbook Change cellar box address]]

Bridge: `apps/frontend/docs/features/account-surface.md`

#frontend #account
