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
4. Loyalty earn only after **paid** order ([[Payments Backend]]).
5. **No free money** — admin wallet credit is gated + idempotent; customer top-up = gateway (planned).
6. Webhooks are at-least-once → idempotency + unique gateway tx id.  
   **Design:** [[ADR Idempotency platform]] · journey [[Journey Idempotent retry checkout webhook]] ·  
   playbook [[Playbook Debug Idempotency]] ·  
   repo `apps/backend/docs/architecture/idempotency.md` + `idempotency-runbook.md`

## Stock

1. Sellable = [[Term available_stock]], never on-hand alone.
2. Place order **reserves** in same TX as order ([[Inventory Backend]]).
3. Payment success **deducts** in same TX as mark paid.
4. Payment fail / cancel **releases** commitment.
5. Admin adjust cannot use reservation/release types (system-owned).
6. Reserve lines **sorted by variant id** to avoid deadlocks.

## Sagas (names)

| Saga | Story |
|------|--------|
| A | Happy checkout → webhook succeed → deduct → loyalty |
| B | Webhook fail → release |
| C | Coupon FOR UPDATE under order TX |
| D | Admin wallet credit |
| E | Gift card redeem |
| F | Webhook / client retry (PH-011 hardening) |

## Related journeys

[[Journey First purchase]] · [[Journey Payment webhook settle]] · [[Journey Account wallet redeem]] · [[Journey Idempotent retry checkout webhook]] · [[Playbook Debug Oversell]] · [[Playbook Debug Webhook]] · [[Playbook Debug Idempotency]] · [[Playbook Document a change]]

Related: [[Inventory]] · [[Payments]] · [[Orders]] · [[Cart and Checkout]] · [[Wallet Backend]] · [[Loyalty Backend]] · [[ADR Stock available not on-hand]] · [[ADR Order reserve and pay deduct atomic]] · [[Layered Backend]]

#architecture #commerce
