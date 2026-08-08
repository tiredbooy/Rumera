# Products

Catalogue products, their tags, images, and variants. Public catalogue reads;
admin draft reads and writes.

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope, pagination, and filtering.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/products` | 🌐 public | List products (paginated, filterable) |
| GET | `/products/:id` | 🌐 public | Get a hydrated product (tags, images, variants) |
| GET | `/products/:id/tags` | 🌐 public | List a product's tags |
| GET | `/products/:id/images` | 🌐 public | List a product's images |
| GET | `/products/:id/variants` | 🌐 public | List a product's variants |
| GET | `/admin/products/:id` | 🛡️ admin | Get editable detail, including inactive drafts |
| POST | `/admin/products/aggregate` | 🛡️ admin | Atomically create the complete editable product graph |
| PUT | `/admin/products/:id/aggregate` | 🛡️ admin | Atomically replace the complete editable product graph |
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
| `brand` | string | Filter by canonical brand slug, e.g. `jack-daniel` |
| `brand_id` | int | Legacy/admin numeric filter; public links should use `brand` |
| `tag_id` | int | Filter by tag |
| `is_active` | bool | Filter by active flag |
| `min_price` | number | Minimum variant price |
| `max_price` | number | Maximum variant price |

Default sort is `created_at` `desc`. Supported `sortBy` values: `created_at`,
`title`, `updated_at`, and `price` (minimum active-variant price). Unsupported
values fall back to `created_at`.

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
      "category": "Single Malt",
      "tags": [{ "id": 7, "title": "Gift" }],
      "image_response": null,
      "is_active": true,
      "min_price": 39.9,
      "max_price": 89.0,
      "active_variant_count": 2,
      "available_variant_count": 1,
      "available_stock": 2
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

`available_stock` is the sellable quantity summed across active variants after
committed stock is subtracted. It is `0` when no active variant has sellable
stock. Storefronts may use it for truthful low-stock disclosure, but should not
display high-stock quantities as urgency messaging.

**Errors:** `400 INVALID_QUERY`.

---

## Get product

```
GET /products/:id
```

Returns a fully-hydrated `ProductDetail`, including the `tags`, `images`, and
`variants` arrays. Top-level `images` contains only the product gallery;
variant-specific images are returned under their owning variant. `images`,
`variants`, and each variant's `options`/`images` are explicit empty arrays when
no rows exist.

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
    "updated_at": "2026-07-26T12:00:00Z",
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
        "is_active": true,
        "available_stock": 8,
        "options": [
          {
            "id": 5,
            "option_type_id": 2,
            "option_type_title": "volume",
            "option_type": "Volume",
            "value": "700ml"
          }
        ],
        "images": [
          {
            "id": 89,
            "image_url": "https://cdn.example.com/v/31-1.jpg",
            "alt_text": "700ml bottle",
            "sort_order": 0,
            "is_primary": true
          }
        ]
      }
    ]
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Get product for editing

```
GET /admin/products/:id
Authorization: Bearer <access_token>
```

Returns the same hydrated `ProductDetail` projection as the public detail route,
including variant option values and variant-specific images, but includes
inactive drafts. This response is not stored in the public product cache.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

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

**Response** `200 OK` — array of product-gallery `ImageResponse` values. Images
owned by a variant are intentionally excluded:

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

## Save the complete product graph

The admin product editor uses one authoritative write rather than chaining
product, tag, variant, option, and image requests:

```http
POST /admin/products/aggregate
PUT  /admin/products/:id/aggregate
Authorization: Bearer <access_token>
Content-Type: application/json
```

Both routes accept the complete editor-owned snapshot. The create route returns
`201 Created`; the update route returns `200 OK`. Both return the hydrated admin
`ProductDetail` that should replace the client's local form state.

```json
{
  "operation_id": "3f52f83b-e9dd-4c7f-b53c-2f62353b9151",
  "expected_updated_at": "2026-07-26T12:00:00Z",
  "title": "Highland Single Malt",
  "code": null,
  "slug": "highland-single-malt",
  "category_id": 3,
  "description": null,
  "brand_id": 7,
  "country_of_origin": "Scotland",
  "abv": 43,
  "weight": 1200,
  "is_active": true,
  "meta_title": null,
  "meta_description": null,
  "meta_tags": ["whisky"],
  "tag_ids": [4, 9],
  "variants": [
    {
      "id": 31,
      "sku": "HSM-12-700",
      "price": 39.9,
      "compare_at_price": 49.9,
      "is_active": true,
      "option_value_ids": [5]
    }
  ],
  "images": [
    {
      "id": 88,
      "alt_text": "Bottle front",
      "is_primary": true
    },
    {
      "storage_key": "uploads/550e8400-e29b-41d4-a716-446655440000.webp",
      "alt_text": "Bottle back",
      "is_primary": false
    }
  ]
}
```

`expected_updated_at` is omitted on create and required on update. Copy it from
the latest admin detail response. A stale value returns `409 CONFLICT` with an
`expected_updated_at` field error instead of overwriting a newer aggregate save.

`operation_id` is a UUID generated once per immutable save attempt. If a response
is lost, retry the exact same body with the same ID. A completed operation is
replayed without repeating mutations or requiring its staged files to still
exist. Reusing an ID for different content returns `409 CONFLICT` with an
`operation_id` field error.

Snapshot rules:

- Nullable scalar fields are values, not PATCH markers. Send `null` to clear one.
- `tag_ids`, `variants`, `option_value_ids`, and `images` are authoritative arrays;
  an empty array clears that collection.
- Existing variants and images retain identity by sending their `id`. Omitting an
  existing variant requests deletion. Variants with inventory or movement history
  cannot be deleted and return a `variants` conflict.
- New variants omit `id`. SKUs are globally unique case-insensitively, and each
  non-empty option combination must be unique within the product.
- Existing images send `id` without a source. A new image sends exactly one of
  `storage_key` (from a staged `/admin/uploads` upload) or `image_url` (external
  HTTPS/root-relative URL). A non-empty gallery has exactly one primary image.

All product fields, tags, variants, option assignments, and product-gallery rows
commit in one database transaction. Validation and relationship errors use exact
paths such as `tag_ids`, `variants.1.sku`, `variants.0.option_value_ids`, or
`images.2`. Detached local media is cleaned after commit and remains recoverable
through media reconciliation if immediate cleanup fails.

The granular product/tag/variant/image write routes below remain available for
specialized administrative operations. Each child mutation advances the parent
product graph revision, so an editor loaded before that mutation receives a stale
`expected_updated_at` conflict rather than silently overwriting it. The product
editor's atomicity and retry contract is still defined by the aggregate routes.

**Errors:** `400 INVALID_JSON`/`INVALID_PARAMS`, `401 UNAUTHORIZED`,
`403 INSUFFICIENT_PERMISSIONS`, `404 PRODUCT_NOT_FOUND`,
`409 CONFLICT`, `422 VALIDATION_ERROR`.

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

Submitted `tag_ids` are persisted with the product. Duplicate IDs in one request
are collapsed.

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

Omitting `tag_ids` leaves the current tag set unchanged; sending an empty array
clears it. Slug and code uniqueness checks exclude the product being edited, so
resubmitting unchanged values is valid.

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
