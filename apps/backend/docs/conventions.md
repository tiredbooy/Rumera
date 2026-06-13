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
