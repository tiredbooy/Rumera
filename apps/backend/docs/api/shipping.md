# Shipping

**Implementation (feature slice):** `internal/features/shipping/`

Shipping zones, their methods, and checkout rate estimation. Zone/method reads are public; managing zones and methods is admin-only.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/shipping/zones` | 🌐 public | List shipping zones |
| GET | `/shipping/zones/:id` | 🌐 public | Get a zone (with its methods) |
| GET | `/shipping/zones/:id/methods` | 🌐 public | List a zone's methods |
| GET | `/shipping/methods/:id` | 🌐 public | Get a single method |
| GET | `/shipping/available` | 🌐 public | Methods available for checkout by region + **package weight (kg)** |
| POST | `/admin/shipping/zones` | 🛡️ admin | Create a zone |
| PATCH | `/admin/shipping/zones/:id` | 🛡️ admin | Update a zone |
| DELETE | `/admin/shipping/zones/:id` | 🛡️ admin | Delete a zone |
| POST | `/admin/shipping/zones/:id/methods` | 🛡️ admin | Create a method under a zone |
| PATCH | `/admin/shipping/methods/:id` | 🛡️ admin | Update a method |
| DELETE | `/admin/shipping/methods/:id` | 🛡️ admin | Delete a method |

Each zone covers one or more region codes and contains nested shipping methods. A method's `rate_type` determines how its cost is computed: `flat_rate`, `per_kg`, `percentage`, or `free`.

---

## List shipping zones

```
GET /shipping/zones
```

**Filters** (plus standard pagination/sorting — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `is_active` | bool | Filter by active flag |

**Response** `200 OK` — paginated `results` of `ShippingZoneResponse`:

```json
{
  "results": [
    {
      "id": 1,
      "name": "North America",
      "description": "US & Canada",
      "region_codes": ["US", "CA"],
      "is_active": true
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total_items": 3, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

**Errors:** `400 INVALID_QUERY`.

---

## Get a zone

```
GET /shipping/zones/:id
```

**Response** `200 OK` — `ShippingZoneResponse`. The `methods` array is populated for single-zone reads:

```json
{
  "data": {
    "id": 1,
    "name": "North America",
    "region_codes": ["US", "CA"],
    "is_active": true,
    "methods": [
      {
        "id": 10,
        "name": "Standard",
        "rate_type": "flat_rate",
        "base_rate": 5.99,
        "is_active": true,
        "estimated_cost": 0
      }
    ]
  }
}
```

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## List a zone's methods

```
GET /shipping/zones/:id/methods
```

**Filters** (plus standard pagination/sorting — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `is_active` | bool | Filter by active flag |
| `rate_type` | string | One of `flat_rate` `per_kg` `percentage` `free` |

**Response** `200 OK` — paginated `results` of `ShippingMethodResponse`. **Errors:** `400 INVALID_PARAMS`/`INVALID_QUERY`, `404 NOT_FOUND`.

---

## Get a method

```
GET /shipping/methods/:id
```

**Response** `200 OK` — `ShippingMethodResponse`:

```json
{
  "data": {
    "id": 10,
    "name": "Express",
    "carrier": "FedEx",
    "rate_type": "per_kg",
    "base_rate": 3.50,
    "free_above_amount": 100.0,
    "min_delivery_days": 1,
    "max_delivery_days": 2,
    "max_weight_kg": 30.0,
    "is_active": true,
    "estimated_cost": 0
  }
}
```

`estimated_cost` is `0` here and only computed by the available-for-checkout endpoint.

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Available methods for checkout

```
GET /shipping/available?region=<code>&weight=<kg>&subtotal=<amount>
```

Returns the methods deliverable to a region, with `estimated_cost` calculated from each method's `rate_type` and the supplied **package weight**.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `region` | string | ✓ | Region code (storefront: address **country**), e.g. `IR` |
| `weight` | float | | Package weight in kg (default `0`, must be ≥ 0). Storefront: Σ cart `weight_kg × quantity` (PH-020c). |
| `subtotal` | float | | Cart subtotal for free-above / percentage rates (default `0`) |

**Storefront truth (PH-020c):** FE passes the summed cart package weight; place-order **re-sums** line weights from catalogue and re-authorizes the method. Methods with `max_weight_kg` below the package are excluded.

**Response** `200 OK` — `data` array of `ShippingMethodResponse` with `estimated_cost` populated:

```json
{
  "data": [
    { "id": 10, "name": "Standard", "rate_type": "flat_rate", "base_rate": 5.99, "is_active": true, "estimated_cost": 5.99 }
  ]
}
```

**Errors:** `400 INVALID_QUERY` (missing `region`, or negative/non-numeric `weight` / `subtotal`).

---

## Create a zone

```
POST /admin/shipping/zones
Authorization: Bearer <admin access_token>
```

**Request body** — `CreateShippingZoneReq`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✓ | max 100 |
| `description` | string | | |
| `region_codes` | string[] | ✓ | min 1 item |
| `is_active` | bool | | defaults server-side |

```json
{
  "name": "Europe",
  "region_codes": ["DE", "FR", "IT"],
  "is_active": true
}
```

**Response** `201 Created` — `ShippingZoneResponse`. **Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `422 VALIDATION_ERROR`.

---

## Update a zone

```
PATCH /admin/shipping/zones/:id
Authorization: Bearer <admin access_token>
```

All fields optional — only supplied fields change.

| Field | Type | Validation |
|-------|------|------------|
| `name` | string | omitempty, max 100 |
| `description` | string | |
| `region_codes` | string[] | omitempty, min 1 item |
| `is_active` | bool | |

**Response** `200 OK` — updated `ShippingZoneResponse`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `422 VALIDATION_ERROR`.

---

## Delete a zone

```
DELETE /admin/shipping/zones/:id
Authorization: Bearer <admin access_token>
```

**Response** `204 No Content`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Create a method

```
POST /admin/shipping/zones/:id/methods
Authorization: Bearer <admin access_token>
```

Creates a method under the zone identified by the path `:id`.

**Request body** — `CreateShippingMethodReq`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✓ | max 100 |
| `carrier` | string | | omitempty, max 100 |
| `description` | string | | |
| `rate_type` | string | ✓ | one of `flat_rate` `per_kg` `percentage` `free` |
| `base_rate` | float | | min 0 |
| `free_above_amount` | float | | omitempty, > 0 |
| `min_delivery_days` | int | | omitempty, min 0 |
| `max_delivery_days` | int | | omitempty, min 0 |
| `max_weight_kg` | float | | omitempty, > 0 |
| `is_active` | bool | | defaults server-side |

```json
{
  "name": "Express",
  "carrier": "FedEx",
  "rate_type": "per_kg",
  "base_rate": 3.50,
  "free_above_amount": 100.0,
  "min_delivery_days": 1,
  "max_delivery_days": 2,
  "max_weight_kg": 30.0
}
```

**Response** `201 Created` — `ShippingMethodResponse`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND` (zone), `422 VALIDATION_ERROR`.

---

## Update a method

```
PATCH /admin/shipping/methods/:id
Authorization: Bearer <admin access_token>
```

All fields optional — only supplied fields change. Same field set as create, each `omitempty` (and `rate_type` validated against the same `oneof` set when present).

**Response** `200 OK` — updated `ShippingMethodResponse`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `422 VALIDATION_ERROR`.

---

## Delete a method

```
DELETE /admin/shipping/methods/:id
Authorization: Bearer <admin access_token>
```

**Response** `204 No Content`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.
