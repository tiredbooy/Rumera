---
tags:
  - frontend
  - loyalty
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Loyalty FE

Storefront Cellar Club UX (PH-040c).

| Piece | Location |
|-------|----------|
| Rewards page | `/account/rewards` · `features/loyalty/components/rewards-view.tsx` |
| Reason labels | `features/loyalty/reasons.ts` |
| Redeem API + key | `features/loyalty/api.ts` |
| Redeem Toman/point | `GET /loyalty` `redeem_value` · no hardcoded 1000 (PR-003l) |
| Customer ledger | `listLoyaltyTransactions` → `{results, pagination}` · hook still returns the row array (PR-003j) |
| Review earn toast | `write-review-dialog.tsx` |
| Checkout payment step | `checkout-payment-step.tsx` — link to `/account/rewards`; no unpaid earn amount (PR-003m) |
| Order confirm honesty | `order-confirmation-view.tsx` |
| Admin rates (read-only) | `/admin/loyalty` · `LoyaltyProgrammeView` (PH-040d) |
| Admin members | `/admin/loyalty` search + `/admin/loyalty/[userID]` (PR-003b) |

`/admin/loyalty` is the operator surface: env programme snapshot + member
search (`q`, `tier`, `{results, pagination}`). Member detail shows balance,
lifetime, tier, paginated ledger, and an adjust form (UUID, delta, note,
`Idempotency-Key`) hidden without `customers:write`. Programme fetch failure
still uses `AdminDataErrorState` + «تلاش دوباره» (PR-003k); members stay
available. `customers:read` stays on `requirePermission`.

Engine: [[Loyalty Backend]] (earn after paid / verified review).  
Domain: [[Loyalty Wallet Gift Cards]]

Bridge: `apps/frontend/docs/features/loyalty.md`

#frontend #loyalty
