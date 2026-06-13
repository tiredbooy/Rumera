# Products

Catalogue products, their tags, images, and variants. Public reads; admin writes.

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and filtering.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/products` | 🌐 public | List products (paginated, filterable) |
| GET | `/products/:id` | 🌐 public | Get a hydrated product (tags, images, variants) |
| GET | `/products/:id/tags` | 🌐 public | List a product's tags |
| GET | `/products/:id/images` | 🌐 public | List a product's images |
| GET | `/products/:id/variants` | 🌐 public | List a product's variants |
| POST | `/admin/products` | 🛡️ admin | Create a product |
| PATCH | `/admin/products/:id` | 🛡️ admin | Update a product |
| DELETE | `/admin/products/:id` | 🛡️ admin | Delete a product |
| POST | `/admin/products/:id/tags` | 🛡️ admin | Attach tags to a product |
| PUT | `/admin/products/:id/tags` | 🛡️ admin | Replace a product's tag set |
| DELETE | `/admin/products/:id/tags` | 🛡️ admin | Detach tags from a product |

> Variant create lives under products (`POST /admin/products/:id/variants`) — see [Variants](./variants.md).

---

## List products

```
GET /products
```

**Query parameters** (plus standard pagination/sorting — `page`, `limit`, `sortBy`, `orderBy`, `search` — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `category_id` | int | Filter by category |
| `brand_id` | int | Filter by brand |
| `tag_id` | int | Filter by tag |
| `is_active` | bool | Filter by active flag |
| `min_price` | number | Minimum variant price |
| `max_price` | number | Maximum variant price |

Default sort is `created_at` `desc`.

**Response** `200 OK` — paginated list of lightweight `ProductListItem`:

```json
{
  "results": [
    {
      "id": 12,
      "title": "Highland Single Malt",
      "code": "HSM-12",
      "slug": "highland-single-malt",
      "brand": "Glenmore",
      "is_active": true,
      "min_price": 39.9,
      "max_price": 89.0
    }
  ],
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

**Errors:** `400 INVALID_QUERY`.

---

## Get product

```
GET /products/:id
```

Returns a fully-hydrated `ProductDetail`, including the `tags`, `images`, and `variants` arrays.

**Response** `200 OK`

```json
{
  "data": {
    "id": 12,
    "title": "Highland Single Malt",
    "code": "HSM-12",
    "slug": "highland-single-malt",
    "category_id": 3,
    "description": "A peaty, full-bodied malt.",
    "brand_id": 7,
    "country_of_origin": "Scotland",
    "abv": 43.0,
    "weight": 1.2,
    "is_active": true,
    "meta_title": "Highland Single Malt | Glenmore",
    "meta_description": "Buy Highland Single Malt online.",
    "meta_tags": ["whisky", "single-malt"],
    "tags": [
      { "id": 4, "title": "Peated" }
    ],
    "images": [
      {
        "id": 88,
        "image_url": "https://cdn.example.com/p/12-1.jpg",
        "alt_text": "Bottle front",
        "sort_order": 0,
        "is_primary": true
      }
    ],
    "variants": [
      {
        "id": 31,
        "sku": "HSM-12-700",
        "price": 39.9,
        "compare_at_price": 49.9,
        "is_active": true
      }
    ]
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List product tags

```
GET /products/:id/tags
```

**Response** `200 OK` — array of `TagResponse` wrapped in `data`:

```json
{ "data": [ { "id": 4, "title": "Peated" } ] }
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List product images

```
GET /products/:id/images
```

**Response** `200 OK` — array of `ImageResponse`:

```json
{
  "data": [
    {
      "id": 88,
      "image_url": "https://cdn.example.com/p/12-1.jpg",
      "alt_text": "Bottle front",
      "sort_order": 0,
      "is_primary": true
    }
  ]
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List product variants

```
GET /products/:id/variants
```

**Response** `200 OK` — array of `VariantResponse` (see [Variants](./variants.md) for the shape).

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create product

```
POST /admin/products
Authorization: Bearer <access_token>
```

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | ✓ | max 255 |
| `code` | string | | max 80 |
| `slug` | string | | |
| `category_id` | int | | min 1 |
| `description` | string | | |
| `brand_id` | int | | min 1 |
| `country_of_origin` | string | | max 100 |
| `abv` | number | | 0–100 |
| `weight` | number | | min 0 |
| `meta_title` | string | | max 225 |
| `meta_description` | string | | |
| `meta_tags` | string[] | | |
| `tag_ids` | int[] | | tags attached on create |
| `variants` | object[] | | inline variants (see [Variants](./variants.md) `CreateVariantReq`) |

```json
{
  "title": "Highland Single Malt",
  "code": "HSM-12",
  "category_id": 3,
  "brand_id": 7,
  "country_of_origin": "Scotland",
  "abv": 43.0,
  "tag_ids": [4],
  "variants": [
    { "sku": "HSM-12-700", "price": 39.9, "compare_at_price": 49.9 }
  ]
}
```

**Response** `201 Created` — the created product wrapped in `data`.

**Errors:** `422 VALIDATION_ERROR`, `400 INVALID_JSON`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `409 CONFLICT`.

---

## Update product

```
PATCH /admin/products/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated.

| Field | Type | Validation |
|-------|------|------------|
| `title` | string | max 255 |
| `code` | string | max 80 |
| `slug` | string | |
| `category_id` | int | min 1 |
| `description` | string | |
| `brand_id` | int | min 1 |
| `country_of_origin` | string | max 100 |
| `abv` | number | 0–100 |
| `weight` | number | min 0 |
| `is_active` | bool | |
| `meta_title` | string | max 225 |
| `meta_description` | string | |
| `meta_tags` | string[] | |
| `tag_ids` | int[] | |

**Response** `200 OK` — the updated product wrapped in `data`.

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Delete product

```
DELETE /admin/products/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Attach / replace / detach tags

```
POST   /admin/products/:id/tags     # attach the given tags (additive)
PUT    /admin/products/:id/tags     # replace the product's entire tag set
DELETE /admin/products/:id/tags     # detach the given tags
Authorization: Bearer <access_token>
```

All three share the same body:

| Field | Type | Required |
|-------|------|----------|
| `tag_ids` | int[] | ✓ |

```json
{ "tag_ids": [4, 9] }
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`/`INVALID_JSON`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.
