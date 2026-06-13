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
      { "id": 5, "option_type": "Volume", "value": "700ml" }
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

**Response** `200 OK` — array of the variant's option values.

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

```json
{
  "sku": "HSM-12-700",
  "price": 39.9,
  "compare_at_price": 49.9,
  "option_value_ids": [5]
}
```

**Response** `201 Created` — the created `VariantResponse`.

**Errors:** `400 INVALID_PARAMS`/`INVALID_JSON`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

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

**Response** `200 OK` — the updated `VariantResponse`.

**Errors:** `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Delete variant

```
DELETE /admin/variants/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Attach variant options

```
POST /admin/variants/:id/options
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

**Errors:** `400 INVALID_PARAMS`/`INVALID_JSON`, `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.
