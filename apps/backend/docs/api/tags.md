# Tags

Free-form product tags. Public reads; admin writes. To attach/detach tags on a product see [Products](./products.md).

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and filtering.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/tags` | 🌐 public | List tags (paginated; also the admin typeahead list) |
| GET | `/tags/:id` | 🌐 public | Get a single tag |
| POST | `/admin/tags` | 🛡️ admin | Create a tag |
| PATCH | `/admin/tags/:id` | 🛡️ admin | Update a tag |
| DELETE | `/admin/tags/:id` | 🛡️ admin | Delete a tag |

> **No `GET /admin/tags`.** There is no staff-only tag list. Admin typeahead,
> the product-form tag picker, and the admin tags board all call public
> `GET /tags` with `limit` ≤ `100`. Writes stay `POST` / `PATCH` / `DELETE /admin/tags`.

---

## List tags

```
GET /tags
```

This is the only tag list. Storefront and admin clients share it.

**Query parameters:** standard pagination/sorting only — `page`, `limit`
(max `100`), `sortBy`, `orderBy`, `search` (see [Conventions](../conventions.md)).
Default sort is `created_at` `desc`. Supported `sortBy` values: `created_at`,
`updated_at`, `title`, `slug`. `limit` above `100` is `400 INVALID_QUERY`.

Admin typeahead typically requests `GET /tags?limit=100&sortBy=title&orderBy=asc`
and pages when `pagination.total_pages` is greater than 1.

**Response** `200 OK` — paginated list of `Tag`:

```json
{
  "results": [
    {
      "id": 4,
      "title": "Peated",
      "description": "Smoky, peat-influenced flavour",
      "created_at": "2026-01-10T08:00:00Z",
      "updated_at": "2026-01-10T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 60,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

**Errors:** `400 INVALID_QUERY`.

---

## Get tag

```
GET /tags/:id
```

**Response** `200 OK` — a `Tag`:

```json
{
  "data": {
    "id": 4,
    "title": "Peated",
    "description": "Smoky, peat-influenced flavour",
    "created_at": "2026-01-10T08:00:00Z",
    "updated_at": "2026-01-10T08:00:00Z"
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create tag

```
POST /admin/tags
Authorization: Bearer <access_token>
```

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | ✓ | max 255 |
| `description` | string | | |

```json
{ "title": "Peated", "description": "Smoky, peat-influenced flavour" }
```

**Response** `201 Created` — the created `Tag`.

**Errors:** `422 VALIDATION_ERROR`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `409 CONFLICT`.

---

## Update tag

```
PATCH /admin/tags/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated.

| Field | Type | Validation |
|-------|------|------------|
| `title` | string | max 255 |
| `description` | string | |

**Response** `200 OK` — the updated `Tag`.

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Delete tag

```
DELETE /admin/tags/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.
