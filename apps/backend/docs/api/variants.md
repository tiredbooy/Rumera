# Variants

Purchasable product variants (SKU, price, options, images). Public reads; admin writes. Variants are always created under a parent product.

See [Authentication](../authentication.md) for trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

Legend: 🌐 public · 🔒 customer · 🛡️ admin

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/variants/:id` | 🌐 public | Get a variant with options and images |
| GET | `/variants/:id/options` | 🌐 public | List a variant's option values |
| GET | `/variants/:id/images` | 🌐 public | List a variant's images |
| POST | `/admin/products/:id/variants` | 🛡️ admin | Create a variant under a product |
| PATCH | `/admin/variants/:id` | 🛡️ admin | Update a variant |
| DELETE | `/admin/variants/:id` | 🛡️ admin | Delete a variant |
| POST | `/admin/variants/:id/options` | 🛡️ admin | Attach option values to a variant |
| PUT | `/admin/variants/:id/options` | 🛡️ admin | Replace the complete option combination |
| GET / POST | `/admin/option-types` | 🛡️ admin | List or create reusable option types |
| GET / PATCH / DELETE | `/admin/option-types/:id` | 🛡️ admin | Read, update, or delete an option type |
| GET / POST | `/admin/option-types/:id/values` | 🛡️ admin | List or create values under a type |
| GET / PATCH / DELETE | `/admin/option-values/:id` | 🛡️ admin | Read, update, or delete an option value |

---

## Get variant

```
GET /variants/:id
```

Returns a `VariantResponse` hydrated with its `options` and `images`.

**Response** `200 OK`

```json
{
  "data": {
    "id": 31,
    "sku": "HSM-12-700",
    "price": 39.9,
    "compare_at_price": 49.9,
    "is_active": true,
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
        "id": 88,
        "image_url": "https://cdn.example.com/v/31-1.jpg",
        "alt_text": "Bottle",
        "sort_order": 0,
        "is_primary": true
      }
    ]
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List variant options

```
GET /variants/:id/options
```

**Response** `200 OK` — array of the variant's option values. Each value includes
the stable `option_type_id` and `option_type_title` used by admin editors plus the
customer-facing `option_type` label.

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List variant images

```
GET /variants/:id/images
```

**Response** `200 OK` — array of `ImageResponse`:

```json
{
  "data": [
    {
      "id": 88,
      "image_url": "https://cdn.example.com/v/31-1.jpg",
      "alt_text": "Bottle",
      "sort_order": 0,
      "is_primary": true
    }
  ]
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Create variant

```
POST /admin/products/:id/variants
Authorization: Bearer <access_token>
```

`:id` is the parent product id.

**Request body** (`CreateVariantReq`)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `sku` | string | | max 250 |
| `price` | number | ✓ | min 0 |
| `compare_at_price` | number | | min 0 |
| `option_value_ids` | int[] | | option values to link |

SKUs are optional. Non-empty values are trimmed and unique across the catalogue
case-insensitively. Duplicate non-empty option combinations are rejected within
the parent product regardless of option-value order; multiple variants without
an option combination are allowed.

```json
{
  "sku": "HSM-12-700",
  "price": 39.9,
  "compare_at_price": 49.9,
  "option_value_ids": [5]
}
```

**Response** `201 Created` — the created `VariantResponse`.

Create also inserts a **zero-stock inventory row** (`EnsureForVariant`). Editor
aggregate saves and legacy `POST /admin/products` with inline variants do the
same via `EnsureForVariantTx` in their write transaction — see
[Products](./products.md). Stock stays 0 until an admin restock.

**Errors:** `400 INVALID_PARAMS`/`INVALID_JSON`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `409 CONFLICT` (SKU or option combination already exists).

---

## Update variant

```
PATCH /admin/variants/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated.

| Field | Type | Validation |
|-------|------|------------|
| `sku` | string | max 250 |
| `price` | number | min 0 |
| `compare_at_price` | number | min 0 |
| `is_active` | bool | |

Sending `sku: null` clears an existing optional SKU. A supplied string is
trimmed and must remain non-empty after trimming.

**Response** `200 OK` — the updated `VariantResponse`.

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `409 CONFLICT` (case-insensitive SKU already exists).

---

## Delete variant

```
DELETE /admin/variants/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

Deletion is restricted once a variant owns inventory or movement history. The
aggregate product endpoint reports this as a precise `variants` conflict; the
standalone route returns `409 CONFLICT`. Set `is_active` to false when historical
identity must be retained.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `409 CONFLICT`.

---

## Attach or replace variant options

```
POST /admin/variants/:id/options
PUT  /admin/variants/:id/options
Authorization: Bearer <access_token>
```

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `option_value_ids` | int[] | ✓ |

```json
{ "option_value_ids": [5, 6] }
```

**Response** `204 No Content`.

`POST` is additive and idempotent for an already-attached value. `PUT` replaces
the complete combination atomically; an empty array clears it. A variant may use
multiple option types (for example `750 ml / red`) but only one value from each
type. Values are reusable across any number of variants. A non-empty final
combination must be unique within the product, independent of value order.

**Errors:** `400 INVALID_PARAMS`/`INVALID_JSON`, `409 CONFLICT` (two values from one type or duplicate product combination), `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Manage the option catalogue

Option types are reusable dimensions such as `size`, `color`, `material`,
`volume`, or `pack`. `title` is their stable administrative name and
`display_name` is the customer-facing label.

```http
POST /admin/option-types
Content-Type: application/json

{"title":"volume","display_name":"Volume"}
```

```http
POST /admin/option-types/3/values
Content-Type: application/json

{"value":"750 ml","sort_order":10}
```

Type titles are case-insensitively unique. Value labels are case-insensitively
unique within their type, but the same label may exist under a different type.
All create/update inputs are trimmed and `sort_order` must be non-negative.

Deleting data is deliberately restrictive: an option value attached to any
variant returns `409 CONFLICT`, and an option type with any remaining values also
returns `409 CONFLICT`. Detach/replace variant options first, delete values, then
delete the empty type. Product variant deletion still cascades only its junction
rows; it never deletes reusable catalogue values.
