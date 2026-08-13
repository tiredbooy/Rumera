# API Conventions

Every endpoint follows the same conventions for responses, errors, pagination, and filtering. Learn these once and they apply everywhere.

## Base URL & versioning

```
http://localhost:8080/api/v1
```

All resource endpoints are under `/api/v1`. The only exception is `GET /health`, which is unversioned.

## Success envelope

Single-resource and action responses are wrapped in a `data` envelope:

```json
{
  "data": { "id": 1, "title": "Single Malt" },
  "message": "optional human-readable message"
}
```

| Status | When |
|--------|------|
| `200 OK` | Successful read or update |
| `201 Created` | Resource created |
| `202 Accepted` | Accepted for async processing (e.g. password reset request) |
| `204 No Content` | Successful delete or action with no body |

Defined in [`pkg/response/success.go`](../pkg/response/response.go).

## Paginated envelope

List endpoints return results plus pagination metadata (note: **not** wrapped in `data`):

```json
{
  "results": [ { "id": 1 }, { "id": 2 } ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 137,
    "total_pages": 7,
    "has_next": true,
    "has_prev": false
  }
}
```

`results` is always an array (never `null`). Defined in [`pkg/response/pagination.go`](../pkg/response/pagination.go).

## Error envelope

All errors share one shape:

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "product not found",
    "fields": {
      "email": ["must be a valid email address"]
    }
  }
}
```

- `code` — a **stable, machine-readable** string. Branch on this, not on `message`.
- `message` — human-readable summary.
- `fields` — present only on validation errors (`422`), mapping each invalid field to its messages.

### Common error codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 400 | `INVALID_QUERY` | Bad query parameters |
| 400 | `INVALID_PARAMS` | Bad path parameter (e.g. non-numeric id) |
| 401 | `UNAUTHORIZED` | Authentication required |
| 401 | `MISSING_TOKEN` | No bearer token supplied |
| 401 | `INVALID_TOKEN` | Token invalid or expired |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `FORBIDDEN` | Authenticated but not allowed |
| 403 | `INSUFFICIENT_PERMISSIONS` | Role check failed (non-admin on admin route) |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Uniqueness or state conflict |
| 422 | `VALIDATION_ERROR` | Body failed field validation |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Resource-specific codes (e.g. `OUT_OF_STOCK`, `INVALID_COUPON`, `INSUFFICIENT_FUNDS`, `ORDER_ALREADY_PAID`) are documented on each resource page. The full registry lives in [`pkg/response/codes.go`](../pkg/response/codes.go) and [`pkg/apperr/apperr.go`](../pkg/apperr/apperr.go).

## Pagination & filtering

List endpoints accept these query parameters (via `BaseFilter`):

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | `1` | 1-based page number |
| `limit` | int | `20` | Items per page (max `100`) |
| `sortBy` | string | resource-specific | Field to sort by |
| `orderBy` | string | `desc` | `asc` or `desc` |
| `search` | string | — | Free-text search |

Each resource adds its own filters (e.g. products accept `category_id`, `brand_id`, `min_price`). Those are listed per-resource in the [API reference](./api/README.md).

Example:

```
GET /api/v1/products?page=2&limit=50&sortBy=created_at&orderBy=desc&brand_id=3&is_active=true
```

## Validation

Request bodies are validated with struct tags ([go-playground/validator](https://github.com/go-playground/validator)). On failure you get `422 VALIDATION_ERROR` with a `fields` map keyed by the JSON field name:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "validation failed",
    "fields": {
      "password": ["password must be at least 8 characters"],
      "email": ["must be a valid email address"]
    }
  }
}
```

## Content type

All request bodies are JSON. Send `Content-Type: application/json`. Responses are JSON and gzip-compressed when the client sends `Accept-Encoding: gzip`.

---

## Models ownership (feature slices)

Business domains live under `internal/features/<name>/` and own their domain
structs, request/response types, and mappers.

`internal/models` is **shared only**. Inventory (as of PH-012a):

| File | Shared purpose |
|------|----------------|
| `errors.go` | Cross-feature sentinel errors (`ErrNotFound`, stock, coupon, …) |
| `filter.go` / `pagination.go` | List query helpers |
| `nullable_patch.go` | PATCH omit vs explicit `null` |
| `payment_method.go` | Checkout/payment rail enum (avoids orders↔payments cycle) |
| `product_response.go` / `product_image.go` | Catalogue wire DTOs shared by product/variant/media |
| `tax.go` | Checkout `TaxRate` constant |

### Decision tree (where does a new type go?)

1. **Used by one feature only** → put it in that feature (`model.go` / local file).
2. **Shared pure primitive** (filter, patch helper, constant) → `internal/models`.
3. **Shared domain entity that would create an import cycle** if moved into a
   feature → keep in `internal/models` (or a dedicated shared package later).
   Today that is mainly **catalogue list/detail wire DTOs** and `PaymentMethod`.
4. **Business error returned by 2+ features** → `models.Err*` + map in
   `platform/httpx.HandleError`.

### Intentionally shared (do not “move for purity”)

| Type / file | Why it stays |
|-------------|--------------|
| `ProductListItem`, `ProductDetail`, `ImageResponse`, … | Used by product, variant, media mappers; relocating into `catalog/product` cycles media/variant |
| `ProductImage` | Media + product image repository shape |
| `PaymentMethod` | Orders create pending payments; payments record method — either direction cycles |
| `TaxRate` | Checkout total calculation constant |
| Money/stock/coupon sentinels | Orders, payments, inventory, cart, wallet all `errors.Is` the same values |

### Residual (documented, not moved in PH-012a)

| Item | Note |
|------|------|
| `ErrHeroSchedule` / CTA sentinels | Hero-only today; harmless in shared `errors.go`. Optional later move into `features/hero` if httpx gains feature-local error maps. |
| `ErrHierarchyCycle` / `ErrProductHasHistory` / `ErrAccessDenied` | Shared or multi-feature; keep. Ensure HTTP mapping in **PH-012b**. |
| Stale docs that cited `internal/models/inventory.go` etc. | Fixed under PH-012a for inventory + payments architecture guides. |

**Do**

- Add new domain types inside the owning feature package.
- Use `models.Err*` sentinels when multiple features need the same business error.
- Map those sentinels with **`httpx.HandleError`** (not raw `response.HandleError` alone).

**Do not**

- Grow `internal/models` into a second god domain package.
- Put Gin / SQL / feature service types here.
- Compare sentinels with `==` — always `errors.Is` (and `pgx.ErrNoRows` too).
- Big-bang relocate catalogue wire DTOs without a cycle-safe shared package plan.

Frontend TypeScript must match **JSON tags**, not Go field names.  
See [architecture/domain-map.md](./architecture/domain-map.md) and package doc on `internal/models`.

---

## Error mapping path

| Path | Use when |
|------|----------|
| `platform/httpx.HandleError` | **Preferred** for feature handlers — maps `models.Err*` + `*apperr.AppError` |
| `pkg/response.HandleError` | Only understands `*apperr.AppError`; domain sentinels become 500 |

Money and stock services often return `models.Err*`. Handlers that call
`response.HandleError` directly will 500 on not-found/conflict unless they
pre-map. Use `httpx.HandleError` as the single sanctioned path for new code.

### User-clear errors (PH-012c)

- Known domain failures **must** surface a stable `code` + non-empty `message`
  (never empty text, never `INTERNAL_ERROR` when a sentinel/AppError exists).
- `FromAppError` keeps registry **status/code**; prefers `AppError.Message` when set.
- **Bug fixed:** `INSUFFICIENT_FUNDS` no longer maps to `PAYMENT_FAILED`.
- Wallet shortfall → `INSUFFICIENT_FUNDS`; loyalty points shortfall → `INSUFFICIENT_POINTS`;
  gift redeem → `GIFT_CARD_INVALID`; disabled login → `ACCOUNT_DISABLED`.
- Full catalogue + client guidance: [architecture/error-messages.md](./architecture/error-messages.md).