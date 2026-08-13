---
tags: [architecture, api]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Error model

## Backend

- Services return `*apperr.AppError` **or** `models.Err*` domain sentinels
- **Sanctioned edge map:** `platform/httpx.HandleError` (maps both; uses `errors.Is`)
- Avoid bare `response.HandleError` for domain sentinels (they become 500)
- Envelope: `{ "error": { "code", "message", "fields?" } }`
- Always `errors.Is` (never `==`) for sentinels and `pgx.ErrNoRows`
- 5xx: log root cause server-side; **never** put SQL/stack/secrets in `message`

## User-clear contracts (PH-012c)

| Situation | Code (stable) | Notes |
|-----------|---------------|--------|
| Stock short at reserve/cart | `OUT_OF_STOCK` | Actionable stock message |
| Empty cart checkout | `CART_EMPTY` | |
| Coupon problems | `INVALID_COUPON` / `COUPON_*` / `ORDER_BELOW_MINIMUM` | |
| Wallet short | `INSUFFICIENT_FUNDS` | **Not** `PAYMENT_FAILED` |
| Loyalty points short | `INSUFFICIENT_POINTS` | Distinct from wallet |
| Gift code bad/used | `GIFT_CARD_INVALID` | No enumeration |
| Login banned/inactive | `ACCOUNT_DISABLED` | |
| Wrong password/email | `INVALID_CREDENTIALS` | Same for both (anti-enum) |

`FromAppError` prefers non-empty AppError message; unknown typed codes no longer
collapse to `INTERNAL_ERROR` when Code+Message are set.

Full table: repo `apps/backend/docs/architecture/error-messages.md`.

## Frontend (PH-012d)

Central helper: `apps/frontend/lib/api/user-facing-error.ts`

| API | Use |
|-----|-----|
| `describeApiError` | structured `{ title, description?, fieldErrors? }` |
| `apiErrorToast` | sonner title + description |
| `apiErrorMessage` | compact single line |

- Map high-traffic **codes** → Persian (stock, coupon, funds, points, gift, authz)
- Prefer mapped title; generic fallback only if unmapped **and** message empty/generic
- Wired: checkout place-order + coupon, cart mutations, gift redeem, loyalty redeem, admin wallet credit + account actions, recipe bulk-add
- Residual: NextAuth credentials still collapses login failures to a single Persian line (no code passthrough yet)

Related: [[Wire contracts]] · [[Term envelope]] · [[Request Paths]] · [[Pitfalls and anti-patterns]] · [[Money and stock rules]]

Bridge: FE `docs/platform/api-layer.md` · BE `architecture/error-messages.md` · `pkg/response/codes.go` · `httpx`

#architecture
