# Brands

Product brands. Public reads; admin writes.

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and filtering.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/brands` | 🌐 public | List brands (paginated, filterable) |
| GET | `/brands/slug/:slug` | 🌐 public | Get a brand by canonical slug |
| GET | `/brands/:id` | 🌐 public | Get a single brand |
| POST | `/admin/brands` | 🛡️ admin | Create a brand |
| PATCH | `/admin/brands/:id` | 🛡️ admin | Update a brand |
| DELETE | `/admin/brands/:id` | 🛡️ admin | Delete a brand |

---

## List brands

```
GET /brands
```

**Query parameters** (plus standard pagination/sorting — `page`, `limit`, `sortBy`, `orderBy`, `search` — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `country` | string | Filter by country |
| `founded_from` | int | Founded year lower bound (inclusive) |
| `founded_to` | int | Founded year upper bound (inclusive) |

Default sort is `created_at` `desc`.

There is no `GET /admin/brands`. Operator typeahead (admin product/recipe
editors) uses this public list.

**Response** `200 OK` — paginated list of `Brand`:

```json
{
  "results": [
    {
      "id": 7,
      "title": "Glenmore",
      "slug": "glenmore",
      "country": "Scotland",
      "founded_year": 1894,
      "image_url": "https://cdn.example.com/brands/glenmore.png",
      "description": "Highland distillery.",
      "created_at": "2026-01-10T08:00:00Z",
      "updated_at": "2026-01-10T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 42,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

**Errors:** `400 INVALID_QUERY`.

---

## Get brand

```
GET /brands/:id
```

**Response** `200 OK` — a `Brand`:

```json
{
  "data": {
      "id": 7,
      "title": "Glenmore",
      "slug": "glenmore",
    "country": "Scotland",
    "founded_year": 1894,
    "image_url": "https://cdn.example.com/brands/glenmore.png",
    "description": "Highland distillery.",
    "created_at": "2026-01-10T08:00:00Z",
    "updated_at": "2026-01-10T08:00:00Z"
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Get brand by slug

```
GET /brands/slug/glenmore
```

Returns the same `Brand` representation as the ID route. Public catalogue URLs
use this stable key as `/products?brand=glenmore`; numeric brand IDs are not part
of the canonical storefront URL.

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create brand

```
POST /admin/brands
Authorization: Bearer <access_token>
```

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | ✓ | max 255 |
| `slug` | string | | max 255; generated from title when omitted |
| `country` | string | | max 80 |
| `founded_year` | int | | min 1000 |
| `image_url` | string | | valid url |
| `description` | string | | |

```json
{
  "title": "Glenmore",
  "slug": "glenmore",
  "country": "Scotland",
  "founded_year": 1894,
  "image_url": "https://cdn.example.com/brands/glenmore.png",
  "description": "Highland distillery."
}
```

**Response** `201 Created` — the created `Brand`.

**Errors:** `422 VALIDATION_ERROR`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `409 CONFLICT`.

---

## Update brand

```
PATCH /admin/brands/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated.

| Field | Type | Validation |
|-------|------|------------|
| `title` | string | max 255; unique excluding the current brand id |
| `slug` | string | max 255; canonicalized and unique |
| `country` | string | max 80 |
| `founded_year` | int | min 1000 |
| `image_url` | string | valid url |
| `description` | string | |

Title uniqueness **excludes the current brand id** (same pattern as tags).
PATCH with the same title is not a conflict; PATCH to another brand's title
is `409 CONFLICT`.

**Response** `200 OK` — the updated `Brand`.

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `409 CONFLICT`.

---

## Delete brand

```
DELETE /admin/brands/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `409 CONFLICT`.
