# Inventory

Per-variant stock levels, reorder thresholds, and the movement ledger. The entire surface is admin-only.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/admin/inventory` | 🛡️ admin | List inventory records |
| GET | `/admin/inventory/low-stock` | 🛡️ admin | Records at/below reorder point |
| GET | `/admin/inventory/movements` | 🛡️ admin | List the movement ledger |
| GET | `/admin/inventory/variants/:variantID` | 🛡️ admin | Get a variant's inventory |
| POST | `/admin/inventory/variants/:variantID/adjust` | 🛡️ admin | Adjust stock (record a movement) |
| PATCH | `/admin/inventory/variants/:variantID/reorder` | 🛡️ admin | Update reorder thresholds |
| GET | `/admin/inventory/variants/:variantID/movements` | 🛡️ admin | A variant's movement history |

`available_stock` is always derived as `stock_on_hand - committed_stock`. Movement `type` is one of `purchase`, `restock`, `refund`, `adjustment`, `reservation`, `release`, `damage`.

---

## List inventory

```
GET /admin/inventory
Authorization: Bearer <admin access_token>
```

**Filters** (plus standard pagination/sorting — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `low_stock` | bool | Only records where `stock_on_hand <= reorder_point` |

**Response** `200 OK` — paginated `results` of `InventoryResponse`:

```json
{
  "results": [
    {
      "id": 7,
      "product_variant_id": 312,
      "stock_on_hand": 40,
      "committed_stock": 6,
      "available_stock": 34,
      "reorder_point": 10,
      "reorder_quantity": 50,
      "last_restock_at": "2026-06-01T09:00:00Z",
      "updated_at": "2026-06-10T12:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total_items": 1, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Low-stock inventory

```
GET /admin/inventory/low-stock
Authorization: Bearer <admin access_token>
```

Convenience read for everything at or below its reorder point. Not paginated.

**Response** `200 OK` — `data` array of `InventoryResponse`. **Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## List movements

```
GET /admin/inventory/movements
Authorization: Bearer <admin access_token>
```

**Filters** (plus standard pagination/sorting — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `product_variant_id` | int | Movements for one variant |
| `type` | string | One of `purchase` `restock` `refund` `adjustment` `reservation` `release` `damage` |
| `order_id` | int | Movements referencing an order |

**Response** `200 OK` — paginated `results` of `InventoryMovementResponse`:

```json
{
  "results": [
    {
      "id": 9001,
      "product_variant_id": 312,
      "quantity": 50,
      "type": "restock",
      "reference_order_id": null,
      "note": "Q2 replenishment",
      "created_at": "2026-06-01T09:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total_items": 1, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Get a variant's inventory

```
GET /admin/inventory/variants/:variantID
Authorization: Bearer <admin access_token>
```

**Response** `200 OK` — `InventoryResponse` (same shape as the list rows above).

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.

---

## Adjust stock

```
POST /admin/inventory/variants/:variantID/adjust
Authorization: Bearer <admin access_token>
```

Records a movement against the variant and updates its stock accordingly.

**Request body** — `AdjustStockReq`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `quantity` | int | ✓ | non-zero (`required`) |
| `type` | string | ✓ | one of `purchase` `restock` `refund` `adjustment` `reservation` `release` `damage` |
| `note` | string | | |

```json
{
  "quantity": 25,
  "type": "restock",
  "note": "supplier delivery #4471"
}
```

**Response** `204 No Content`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `422 VALIDATION_ERROR`.

---

## Update reorder thresholds

```
PATCH /admin/inventory/variants/:variantID/reorder
Authorization: Bearer <admin access_token>
```

All fields optional — only supplied fields change.

**Request body** — `UpdateReorderReq`:

| Field | Type | Validation |
|-------|------|------------|
| `reorder_point` | int | omitempty, min 0 |
| `reorder_quantity` | int | omitempty, min 0 |

```json
{
  "reorder_point": 15,
  "reorder_quantity": 60
}
```

**Response** `200 OK` — updated `InventoryResponse`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `422 VALIDATION_ERROR`.

---

## A variant's movement history

```
GET /admin/inventory/variants/:variantID/movements
Authorization: Bearer <admin access_token>
```

Returns the full movement ledger for one variant. Not paginated.

**Response** `200 OK` — `data` array of `InventoryMovementResponse` (same shape as the movements list above).

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.
