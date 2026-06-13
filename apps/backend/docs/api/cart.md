# Cart

The authenticated user's shopping cart: read it, add and update line items, remove items, and clear it.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/cart` | 🔒 customer | Get the caller's cart |
| DELETE | `/cart` | 🔒 customer | Empty the cart |
| POST | `/cart/items` | 🔒 customer | Add an item (or bump quantity) |
| PATCH | `/cart/items/:id` | 🔒 customer | Set a line item's quantity |
| DELETE | `/cart/items/:id` | 🔒 customer | Remove a line item |

> **Ownership:** every endpoint operates on the cart belonging to the authenticated user (resolved from the token), created on demand. There is no way to read or modify another user's cart. All endpoints require `Authorization: Bearer <access_token>`.

> **Server-priced:** line prices are never taken from the client. When an item is added, the unit price is snapshotted server-side from the live variant. On read, each item exposes both `unit_price_snapshot` and the live `current_price`, with `price_changed` flagging any drift so the UI can prompt the customer before checkout.

---

## Get the cart

```
GET /cart
Authorization: Bearer <access_token>
```

Returns the caller's cart, creating an empty one on first access.

**Response** `200 OK` — `CartResponse`:

```json
{
  "data": {
    "id": 42,
    "items": [
      {
        "id": 101,
        "product_id": 7,
        "product_title": "Single Malt 12yr",
        "variant_id": 19,
        "sku": "SM12-700",
        "unit_price_snapshot": 49.90,
        "current_price": 54.90,
        "price_changed": true,
        "quantity": 2,
        "line_total": 99.80,
        "image_url": "https://cdn.example.com/sm12.jpg",
        "options": [
          { "name": "Volume", "value": "700ml" }
        ]
      }
    ],
    "summary": {
      "total_items": 2,
      "unique_items": 1,
      "subtotal": 99.80,
      "discount_total": 0
    }
  }
}
```

`line_total` and `subtotal` use the snapshotted price. `price_changed` is `true` when `current_price` differs from `unit_price_snapshot`.

**Errors:** `401 UNAUTHORIZED`.

---

## Add an item

```
POST /cart/items
Authorization: Bearer <access_token>
```

Adds a variant to the cart. The unit price is set server-side from the live variant — any price in the body is ignored.

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `product_variant_id` | int | ✓ | min `1` |
| `quantity` | int | ✓ | `1`–`999` |

```json
{
  "product_variant_id": 19,
  "quantity": 2
}
```

**Response** `201 Created` — the full `CartResponse` (items + summary), as shown above.

**Errors:** `401 UNAUTHORIZED`, `422 VALIDATION_ERROR`, `404 NOT_FOUND` (unknown variant), `409 OUT_OF_STOCK`.

---

## Update an item's quantity

```
PATCH /cart/items/:id
Authorization: Bearer <access_token>
```

`:id` is the cart **item** id (not the variant id). Sets the line item's quantity to the supplied value.

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `quantity` | int | ✓ | `1`–`999` |

```json
{ "quantity": 3 }
```

**Response** `200 OK` — the full `CartResponse`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 NOT_FOUND` (item not in the caller's cart), `409 OUT_OF_STOCK`.

---

## Remove an item

```
DELETE /cart/items/:id
Authorization: Bearer <access_token>
```

`:id` is the cart **item** id.

**Response** `200 OK` — the full `CartResponse` reflecting the removal.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Clear the cart

```
DELETE /cart
Authorization: Bearer <access_token>
```

Removes all items from the caller's cart.

**Response** `204 No Content`. **Errors:** `401 UNAUTHORIZED`.
