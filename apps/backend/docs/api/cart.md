# Cart


**Implementation (feature slice):** `internal/features/cart/`
The authenticated user's shopping cart: read it, add and update line items, remove items, and clear it.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

**Invariants (PR-004a):**

- **Auth-only.** Every route is `Authorization: Bearer <access_token>`. Guests are `401`; there is no guest / anonymous cart.
- **One cart per user.** `carts.user_id` is `UNIQUE NOT NULL`. `GetOrCreate` is `INSERT … ON CONFLICT (user_id)` — a second add or `GET /cart` for the same user reuses that row.

**Unexpected failures (PR-010b):** repo/SQL errors are logged in the cart service (`op` + cause) and returned as `500 INTERNAL_ERROR` with the generic message. The body never includes SQL. Known stock / not-found / unavailable variants stay 4xx (`OUT_OF_STOCK`, `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `NOT_FOUND`).

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/cart` | 🔒 customer | Get the caller's cart |
| DELETE | `/cart` | 🔒 customer | Empty the cart |
| POST | `/cart/items` | 🔒 customer | Add an item (or bump quantity) |
| POST | `/cart/items/bulk` | 🔒 customer | Add many items; skip unavailable |
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
        "available_stock": 1,
        "line_total": 99.80,
        "weight_kg": 1.25,
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

### Line availability (U-3)

| Field | Type | Meaning |
|-------|------|---------|
| `available_stock` | integer | Sellable stock for the line's variant right now: `inventory.stock_on_hand - committed_stock`, clamped at `0` (a missing inventory row reads as `0`). |

This is the **same** number `POST /orders` enforces when it reserves stock, so the
cart can show the truth up front instead of failing at checkout: `0` means the line
is sold out, and any value below `quantity` means the line cannot be ordered as it
stands. Clients cap the quantity stepper at `available_stock`.

### Line weight (PH-020c)

| Field | Type | Meaning |
|-------|------|---------|
| `weight_kg` | number, omitempty | Unit package weight from `products.weight` (kg). Omitted when unset. |

Checkout **sums** `weight_kg × quantity` for `GET /shipping/available?weight=…`.  
Order placement **re-sums** server-side and authorizes the shipping method against that package weight; client cannot override region (from address country).

**Errors:** `401 UNAUTHORIZED`.

---

## Add an item

```
POST /cart/items
Authorization: Bearer <access_token>
```

Adds a variant to the cart. The unit price is set server-side from the live variant — any price in the body is ignored. After a successful write the server records an `add_to_cart` recommendation signal for the parent product (PR-050d). Recs failure is logged and does not fail the cart response. Same-day duplicates (including the storefront POST) do not double-weight.

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

## Add items in bulk

```
POST /cart/items/bulk
Authorization: Bearer <access_token>
```

Adds many variants in one request (e.g. all of a recipe's ingredients). Each
item is validated independently: unknown, inactive, or out-of-stock variants
(and variants whose parent product is missing or inactive) are **skipped**, not
fatal. The caller still receives everything that could be added. Same per-user
cart as `POST /cart/items`. Line prices are set server-side from the live
variant; any client price is ignored.

**Request body** — `AddCartItemsReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `items` | object[] | ✓ | `1`–`100` items |

Each `items[]` entry matches `POST /cart/items`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `product_variant_id` | int | ✓ | min `1` |
| `quantity` | int | ✓ | `1`–`999` |

```json
{
  "items": [
    { "product_variant_id": 19, "quantity": 2 },
    { "product_variant_id": 44, "quantity": 1 }
  ]
}
```

**Response** `201 Created` — `BulkAddResult`:

```json
{
  "data": {
    "cart": {
      "id": 42,
      "items": [],
      "summary": {
        "total_items": 2,
        "unique_items": 1,
        "subtotal": 99.80,
        "discount_total": 0
      }
    },
    "added": 1,
    "skipped": [
      { "product_variant_id": 44, "reason": "out_of_stock" }
    ]
  }
}
```

`cart` is the refreshed `CartResponse` (same shape as `GET /cart`). `added` is
the count of lines that were inserted or bumped. `skipped` lists variants that
were not added.

`skipped[].reason` is one of:

| Reason | When |
|--------|------|
| `invalid` | Variant id or quantity is not a positive integer |
| `not_found` | Variant id does not exist, or its parent product is missing |
| `unavailable` | Variant is inactive, or its parent product is inactive |
| `out_of_stock` | Sellable stock is less than existing cart quantity + requested quantity |

A request that skips every line still returns `201` with `added: 0` and a
populated `skipped` list. Bind failures on the body (`items` missing, empty,
more than 100 entries, or an item failing the field rules above) reject the
whole request.

**Errors:** `401 UNAUTHORIZED`, `422 VALIDATION_ERROR`. Unexpected repo/SQL
failures follow the wrapping rule above (`500 INTERNAL_ERROR`, no SQL in the
body).

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
