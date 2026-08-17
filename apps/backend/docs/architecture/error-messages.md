# User-clear error contracts (PH-012c)

Shoppers and staff must understand **what failed** and **what to do next**.
Never return only `INTERNAL_ERROR` / empty `message` when the domain already
knows the reason.

## Envelope

```json
{
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "not enough stock available for one or more items",
    "fields": { "email": ["must be a valid email address"] }
  }
}
```

| Field | Rule |
|-------|------|
| `code` | Stable machine id — FE may branch; never invent per-request codes |
| `message` | Non-empty English, actionable; **no** SQL/stack/secrets |
| `fields` | Validation only (`422`) — map of field → messages |

## Mapping path

1. Service returns `models.Err*` **or** `*apperr.AppError` (or wrap with `%w`).
2. Handler calls **`platform/httpx.HandleError`** (never bare `response.HandleError` for domain sentinels).
3. `httpx` maps sentinels → `response.AppCode`; `*apperr.AppError` via `response.FromAppError`.
4. Unknown bare `error` → `500 INTERNAL_ERROR` with generic message (root cause stays in logs only).

### Cart unexpected SQL (PR-010b)

Unexpected cart repo/DB failures (`GetOrCreate`, `GetItems`, `AddItem`, …) are
logged in `internal/features/cart` (`slog.Error` with `op` + cause) and returned
as `apperr.ErrInternal`. The public envelope stays `500 INTERNAL_ERROR` with the
generic message — no SQL. Typed mappings (`PRODUCT_NOT_FOUND`,
`PRODUCT_UNAVAILABLE`, `OUT_OF_STOCK`, `NOT_FOUND`) are unchanged.

`PRODUCT_UNAVAILABLE` on add-to-cart covers an inactive variant **and** an
inactive parent product. `GetByIDForAdmin` distinguishes a missing parent
(`PRODUCT_NOT_FOUND`) from a draft/unpublished one so a line cannot insert
then vanish on `GetItems` (`p.is_active = true`). Bulk add skips those
lines as `unavailable` rather than failing the whole request.

## Money / checkout / auth catalogue (high traffic)

| Code | HTTP | Meaning | Typical trigger | Client guidance |
|------|------|---------|-----------------|-----------------|
| `OUT_OF_STOCK` | 409 | Not enough sellable stock | Order create reserve; cart add | Reduce qty or remove line |
| `PRODUCT_UNAVAILABLE` | 409 | Variant or parent product is inactive | Cart add / bulk add | Pick another product |
| `CART_EMPTY` | 400 | No lines to check out | Place order | Add items first |
| `INVALID_SHIPPING_METHOD` | 400 | Method not allowed for address/weight | Place order | Pick another method |
| `INVALID_COUPON` | 400 | Code unknown | Apply coupon / order | Check spelling |
| `COUPON_EXPIRED` | 400 | Past end date | Coupon validate | Remove coupon |
| `COUPON_NOT_ACTIVE` | 400 | Before start date | Coupon validate | Wait or remove |
| `ORDER_BELOW_MINIMUM` | 400 | Subtotal under coupon min | Coupon validate | Add more items |
| `COUPON_USAGE_LIMIT` | 409 | Global uses exhausted | Coupon validate | Remove coupon |
| `COUPON_USER_LIMIT` | 409 | Per-user uses exhausted | Coupon validate | Remove coupon |
| `INSUFFICIENT_FUNDS` | 409 | Wallet balance too low | Wallet purchase/withdraw | Top up or lower amount |
| `INSUFFICIENT_POINTS` | 409 | Loyalty points too low | Loyalty redeem | Earn more or redeem fewer |
| `LOYALTY_DISABLED` | 409 | Programme kill-switch is off | Redeem / admin adjust | Operator re-enables via PUT programme |
| `GIFT_CARD_INVALID` | 404 | Bad or already used code | Gift redeem | Check code |
| `ORDER_NOT_FOUND` | 404 | No such order | Get/cancel order | Refresh list |
| `ORDER_ALREADY_PAID` | 409 | Cannot re-pay | Payment confirm path | Stop retry as new pay |
| `ORDER_CANCELLED` | 409 | Order cancelled | Status transition | — |
| `PAYMENT_FAILED` | 402 | Gateway processing failed | Explicit payment fail | Retry or other method |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password | Login | Re-enter credentials |
| `ACCOUNT_DISABLED` | 403 | Banned or inactive user | Login / OTP / refresh | Contact support |
| `UNAUTHORIZED` | 401 | Missing/invalid auth | Protected routes | Sign in |
| `FORBIDDEN` / `INSUFFICIENT_PERMISSIONS` | 403 | Not allowed | Admin RBAC | Ask an admin |
| `VALIDATION_ERROR` | 422 | Field validation | Any bind | Fix `fields` |
| `CONFLICT` | 409 | Uniqueness / state race | Creates | Retry or change key |
| `NOT_FOUND` | 404 | Generic missing resource | Reads | — |
| `INTERNAL_ERROR` | 500 | Unexpected | Bugs / infra | Retry later; ops logs |

Idempotency conflicts (in-flight / body mismatch) use middleware codes already
documented in [idempotency.md](./idempotency.md) / runbook.

## Rules for new errors

1. Prefer existing `code` over inventing synonyms.
2. Add `apperr` sentinel + `response` registry entry + (if multi-feature) `models.Err*` + httpx row.
3. Message: **specific** and safe to show in UI; FE may still map code → Persian.
4. Never put stack traces, SQL, or tokens in `message`.
5. Tests: assert **status + code + non-empty message** for money-path failures.

## Related

- [conventions.md](../conventions.md) — envelopes + error mapping path  
- `pkg/response/codes.go` — registry + `FromAppError`  
- `internal/platform/httpx/errors.go` — domain sentinel map  
- Obsidian: Error model  
