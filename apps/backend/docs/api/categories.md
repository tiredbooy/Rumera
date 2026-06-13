# Categories

Hierarchical product categories. Public reads; admin writes.

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and filtering.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/categories` | 🌐 public | List categories (paginated, filterable) |
| GET | `/categories/tree` | 🌐 public | Full category tree |
| GET | `/categories/:id` | 🌐 public | Get a single category |
| GET | `/categories/:id/children` | 🌐 public | List a category's direct children |
| POST | `/admin/categories` | 🛡️ admin | Create a category |
| PATCH | `/admin/categories/:id` | 🛡️ admin | Update a category |
| DELETE | `/admin/categories/:id` | 🛡️ admin | Delete a category |

---

## List categories

```
GET /categories
```

**Query parameters** (plus standard pagination/sorting — `page`, `limit`, `sortBy`, `orderBy`, `search` — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `parent_id` | int | Filter to children of this parent |

Default sort is `created_at` `desc`.

**Response** `200 OK` — paginated list of `CategoryResponse`:

```json
{
  "results": [
    {
      "id": 3,
      "name": "Whisky",
      "description": "Single malts and blends",
      "parent_id": 1,
      "slug": "whisky"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 24,
    "total_pages": 2,
    "has_next": true,
    "has_prev": false
  }
}
```

**Errors:** `400 INVALID_QUERY`.

---

## Category tree

```
GET /categories/tree
```

Returns the full nested tree of categories.

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "name": "Spirits",
      "slug": "spirits",
      "children": [
        { "id": 3, "name": "Whisky", "slug": "whisky" }
      ]
    }
  ]
}
```

---

## Get category

```
GET /categories/:id
```

**Response** `200 OK` — a `CategoryResponse`:

```json
{
  "data": {
    "id": 3,
    "name": "Whisky",
    "description": "Single malts and blends",
    "parent_id": 1,
    "slug": "whisky"
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List children

```
GET /categories/:id/children
```

**Response** `200 OK` — array of `CategoryResponse` (the category's direct children).

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create category

```
POST /admin/categories
Authorization: Bearer <access_token>
```

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✓ | max 255 |
| `description` | string | | |
| `parent_id` | int | | min 1 |
| `slug` | string | | max 255 |

```json
{
  "name": "Whisky",
  "description": "Single malts and blends",
  "parent_id": 1,
  "slug": "whisky"
}
```

**Response** `201 Created` — the created `CategoryResponse`.

**Errors:** `422 VALIDATION_ERROR`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `409 CONFLICT`.

---

## Update category

```
PATCH /admin/categories/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated.

| Field | Type | Validation |
|-------|------|------------|
| `name` | string | max 255 |
| `description` | string | |
| `parent_id` | int | min 1 |
| `slug` | string | max 255 |

**Response** `200 OK` — the updated `CategoryResponse`.

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Delete category

```
DELETE /admin/categories/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `409 CONFLICT`.
