---
tags: [journey, inventory]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Admin refund restock

## Actor

Staff with `orders:write` or `orders:refund` (command) · inventory write (manual leftover)

## Happy path (PR-020d)

1. Customer return accepted operationally
2. Staff calls `POST /admin/orders/:id/refund` ([[Orders Backend]] · [[Orders]])
3. Order must be paid-like (`paid` / `processing` / `ready_to_ship` / `shipped` / `delivered`)
4. Wallet-paid → `wallet.Refund` credits the buyer ([[Wallet Backend]])
5. Each line restocks via `AdjustStock` type **`refund`** (positive qty) → `stock_on_hand` / available rise
6. Loyalty `ClawbackOrderEarn` (balance only, [[Loyalty Backend]])
7. Status becomes `refunded`

Replay on an already-refunded order is `409` — no second wallet credit.

## Non-wallet / leftover

- Card / crypto / bank / gateway: restock + clawback + status still run. **No PSP refund** — money return is operator/manual
- Coupon uses are **not** restored on refund (unpaid cancel restores them — PR-020j)
- Manual [[Inventory FE]] adjust type `refund` remains for warehouse leftovers / failed mid-flight restock
- `PATCH /admin/orders/:id/status` to `refunded` is **rejected** — use the POST

## Related

[[Inventory]] · [[Payments]] · [[Wallet Backend]] · [[Loyalty Backend]] · [[Playbook Debug Oversell]] · [[Journeys MOC]] · [[Money and stock rules]]

#journey
