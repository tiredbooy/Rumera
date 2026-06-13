# Addresses

A customer's saved shipping/billing addresses. Every endpoint is user-scoped — callers only ever see and mutate their **own** addresses; ownership is enforced server-side.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/addresses` | 🔒 customer | Create an address |
| GET | `/addresses` | 🔒 customer | List own addresses |
| GET | `/addresses/:id` | 🔒 customer | Fetch one own address |
| PATCH | `/addresses/:id` | 🔒 customer | Update an address |
| DELETE | `/addresses/:id` | 🔒 customer | Delete an address |
| POST | `/addresses/:id/default` | 🔒 customer | Mark an address as default |

All endpoints require `Authorization: Bearer <access_token>`. Accessing an address that belongs to another user returns `404 NOT_FOUND`.

---

## Create an address

```
POST /addresses
Authorization: Bearer <access_token>
```

The owner is taken from the access token.

**Request body** — `CreateAddressReq`:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `full_name` | string | ✓ | |
| `address_line1` | string | ✓ | |
| `city` | string | ✓ | |
| `postal_code` | string | ✓ | |
| `country` | string | ✓ | |
| `title` | string | | label, e.g. "Home" |
| `phone_number` | string | | |
| `address_line2` | string | | |
| `state_province` | string | | |
| `is_default` | bool | | |

```json
{
  "title": "Home",
  "full_name": "Jane Doe",
  "phone_number": "+1555…",
  "address_line1": "123 Main St",
  "city": "Lisbon",
  "postal_code": "1000-001",
  "country": "PT",
  "is_default": true
}
```

**Response** `201 Created` — `AddressResponse`:

```json
{
  "data": {
    "id": 1,
    "title": "Home",
    "full_name": "Jane Doe",
    "phone_number": "+1555…",
    "address_line1": "123 Main St",
    "city": "Lisbon",
    "postal_code": "1000-001",
    "country": "PT",
    "is_default": true
  }
}
```

Optional fields (`title`, `phone_number`, `address_line2`, `state_province`) are omitted from the response when null.

**Errors:** `401 UNAUTHORIZED`, `422 VALIDATION_ERROR`.

---

## List addresses

```
GET /addresses
Authorization: Bearer <access_token>
```

Returns the caller's own addresses. Not paginated — a plain array under `data`.

**Response** `200 OK` — `AddressResponse[]`:

```json
{
  "data": [
    {
      "id": 1,
      "title": "Home",
      "full_name": "Jane Doe",
      "address_line1": "123 Main St",
      "city": "Lisbon",
      "postal_code": "1000-001",
      "country": "PT",
      "is_default": true
    }
  ]
}
```

**Errors:** `401 UNAUTHORIZED`.

---

## Get an address

```
GET /addresses/:id
Authorization: Bearer <access_token>
```

**Response** `200 OK` — `AddressResponse`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND` (missing or not owned by the caller).

---

## Update an address

```
PATCH /addresses/:id
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated.

**Request body** — `UpdateAddressReq`:

| Field | Type |
|-------|------|
| `title` | string |
| `full_name` | string |
| `phone_number` | string |
| `address_line1` | string |
| `address_line2` | string |
| `city` | string |
| `state_province` | string |
| `postal_code` | string |
| `country` | string |
| `is_default` | bool |

**Response** `200 OK` — updated `AddressResponse`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 NOT_FOUND`.

---

## Delete an address

```
DELETE /addresses/:id
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.

---

## Set default address

```
POST /addresses/:id/default
Authorization: Bearer <access_token>
```

Marks the address as the caller's default (clearing the flag on any previous default).

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `400 INVALID_PARAMS`, `404 NOT_FOUND`.
