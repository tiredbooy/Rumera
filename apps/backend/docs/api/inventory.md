# Inventory

Per-variant stock levels, reorder thresholds, and the movement ledger. The entire surface is admin-only.

**Architecture (reserve / release / deduct, available vs committed):**
[architecture/inventory.md](../architecture/inventory.md).  
**Admin UI:** [frontend features/inventory](../../frontend/docs/features/inventory.md).

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

`stock_on_hand` is physical stock and `available_stock` is always derived as
`stock_on_hand - committed_stock`. Reserving an order changes only
`committed_stock`; payment confirmation deducts the same quantity from both
physical and committed stock. Movement `type` is one of `purchase`, `restock`,
`refund`, `adjustment`, `reservation`, `release`, `damage`.

---

## List inventory

```
GET /admin/inventory
Authorization: Bearer <admin access_token>
```

**Filters** (plus standard pagination/sorting — see [Conventions](../conventions.md)):

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Product-title or SKU search |
| `low_stock` | bool | Only records where `available_stock <= reorder_point` |

Supported `sortBy` values are `id`, `updated_at`, `stock_on_hand`,
`available_stock`, `reorder_point`, `product_title`, and `sku`. Results use the
inventory ID as a deterministic secondary ordering key.

**Response** `200 OK` — paginated `results` of `InventoryResponse`:

```json
{
  "results": [
    {
      "id": 7,
      "product_variant_id": 312,
      "product_id": 31,
      "product_title": "Test Bottle",
      "sku": "SKU-312",
      "category_title": "Whisky",
      "unit_price": "1250000.50",
      "weight": 1.25,
      "missing_weight": false,
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

### Weight fields (PH-020a — intentional contract extension)

| Field | Type | Meaning |
|-------|------|---------|
| `weight` | number (kg), omitted when unset/invalid | From `products.weight` joined on the variant’s product |
| `missing_weight` | bool (always present) | `true` when weight is null or ≤ 0 — admin signal to fix catalogue before shipping quotes are trustworthy |

Same shape on low-stock list and per-variant get (all use `InventoryResponse`).  
FE types: `apps/frontend/features/inventory/types.ts` (`InventoryItem`).

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
      "note": "Q2 replenishment",
      "created_at": "2026-06-01T09:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total_items": 1, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

**Errors:** `400 INVALID_QUERY`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

`reference_order_id` and `note` are omitted when absent. Results use
`created_at` and `id` as deterministic newest-first ordering keys by default.

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
| `type` | string | ✓ | one of `purchase` `restock` `refund` `adjustment` `damage` |
| `note` | string | | |

```json
{
  "quantity": 25,
  "type": "restock",
  "note": "supplier delivery #4471"
}
```

The stock delta and its movement are committed atomically. A delta that would
make physical stock lower than committed stock is rejected without recording a
movement. `restock` and `refund` require a positive quantity; `purchase` and
`damage` require a negative quantity; `adjustment` accepts either direction.
Reservations and releases are owned by the order lifecycle and are not valid
direct adjustments.

**Response** `204 No Content`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `409 OUT_OF_STOCK`, `422 VALIDATION_ERROR`.

---

## Update reorder thresholds

```
PATCH /admin/inventory/variants/:variantID/reorder
Authorization: Bearer <admin access_token>
```

All fields optional — only supplied fields change. Send `0` to clear either
threshold; omitted fields and JSON `null` are no-ops.

**Request body** — `UpdateReorderReq`:

| Field | Type | Validation |
|-------|------|------------|
| `reorder_point` | int | omitempty, 0 to 2147483647 |
| `reorder_quantity` | int | omitempty, 0 to 2147483647 |

```json
{
  "reorder_point": 15,
  "reorder_quantity": 60
}
```

Updating thresholds does not create a stock movement. `reorder_point` controls
low-stock classification; `reorder_quantity` is advisory and does not trigger an
automatic purchase.

**Response** `200 OK` — the atomically updated `InventoryResponse`. **Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`, `422 VALIDATION_ERROR`.

---

## A variant's movement history

```
GET /admin/inventory/variants/:variantID/movements
Authorization: Bearer <admin access_token>
```

Returns the full movement ledger for one variant. Not paginated.

**Response** `200 OK` — `data` array of `InventoryMovementResponse` (same shape as the movements list above).

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `404 NOT_FOUND`.
