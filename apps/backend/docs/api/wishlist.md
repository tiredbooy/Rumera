# Wishlist

Every customer has exactly one wishlist, created automatically on first access. Add and remove product variants, check membership, and clear the list.

**Implementation (feature slice):** `internal/features/wishlist/`  
(handler · service · repository · model · mapper · `routes.go` → `RegisterCustomer`).  
Composed from `internal/routes/routes.go`. API contracts below are unchanged.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/wishlist` | 🔒 customer | Get the caller's wishlist with items |
| POST | `/wishlist/items` | 🔒 customer | Add a variant to the wishlist |
| DELETE | `/wishlist/items/:id` | 🔒 customer | Remove an item |
| DELETE | `/wishlist` | 🔒 customer | Clear the wishlist |
| GET | `/wishlist/has/:variantID` | 🔒 customer | Check whether a variant is in the wishlist |

> **Ownership:** all endpoints operate on the wishlist belonging to the authenticated user (resolved from the token), created on demand via get-or-create. There is no way to read or modify another user's wishlist.

---

## Get the wishlist

```
GET /wishlist
Authorization: Bearer <access_token>
```

Returns the caller's wishlist and all its items. If the user has no wishlist yet, an empty one is created and returned.

**Response** `200 OK` — `WishlistResponse`:

```json
{
  "data": {
    "id": 17,
    "total": 1,
    "items": [
      {
        "id": 305,
        "product_id": 88,
        "product_title": "Single Malt 12yr",
        "variant_id": 211,
        "sku": "SM-12-700",
        "price": 60.00,
        "compare_at_price": 72.00,
        "image_url": "https://cdn.example.com/p/88.jpg",
        "options": [
          { "name": "Size", "value": "700ml" }
        ],
        "is_in_stock": true,
        "added_at": "2026-06-11T10:00:00Z"
      }
    ]
  }
}
```

`items` is always an array. `total` is the item count.

**Errors:** `401 UNAUTHORIZED`.

---

## Add an item

```
POST /wishlist/items
Authorization: Bearer <access_token>
```

Adds a product variant to the caller's wishlist (creating the wishlist if needed).

**Request body** — `AddWishlistItemReq`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `product_variant_id` | int | ✓ | min `1` |

```json
{ "product_variant_id": 211 }
```

**Response** `201 Created`:

```json
{ "data": { "wishlist_id": 17 } }
```

**Errors:** `422 VALIDATION_ERROR`, `401 UNAUTHORIZED`.

---

## Remove an item

```
DELETE /wishlist/items/:id
Authorization: Bearer <access_token>
```

Removes the wishlist item with the given **item id** (the `id` from each entry in `items`, not the variant id).

**Response** `204 No Content`.

**Errors:** `400 INVALID_PARAMS`, `404 NOT_FOUND`, `401 UNAUTHORIZED`.

---

## Clear the wishlist

```
DELETE /wishlist
Authorization: Bearer <access_token>
```

Removes every item from the caller's wishlist. The wishlist itself is retained (now empty).

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`.

---

## Check membership

```
GET /wishlist/has/:variantID
Authorization: Bearer <access_token>
```

Reports whether the given product variant is currently in the caller's wishlist.

**Response** `200 OK`:

```json
{ "data": { "has_item": true } }
```

**Errors:** `400 INVALID_PARAMS`, `401 UNAUTHORIZED`.
