# Users (admin)

Admin user management: list, inspect, update, and delete user accounts. Customers manage their own profile through [`/auth/me`](./auth.md) instead.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | 🛡️ admin | List users |
| GET | `/admin/users/:userID` | 🛡️ admin | Fetch one user |
| PATCH | `/admin/users/:userID` | 🛡️ admin | Update a user |
| DELETE | `/admin/users/:userID` | 🛡️ admin | Delete a user |

Every endpoint requires an admin token (`Authorization: Bearer <access_token>` + `role=admin`). The `:userID` path parameter is the public **UUID** (`user_id`), not the internal integer id.

---

## List users

```
GET /admin/users
Authorization: Bearer <access_token>
```

Accepts the standard pagination/filter query params (see [Conventions](../conventions.md)), plus `role` (`customer` `admin` `vendor`), `is_active`, `gender` (`male` `female` `other`), `created_from`, `created_to`.

**Response** `200 OK` — paginated `UserListItem[]`:

```json
{
  "results": [
    {
      "user_id": "5b2c…-uuid",
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "role": "customer",
      "is_active": true,
      "created_at": "2026-06-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 1,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`.

---

## Get a user

```
GET /admin/users/:userID
Authorization: Bearer <access_token>
```

**Response** `200 OK` — `UserAdminResponse` (the full profile plus admin-only fields):

```json
{
  "data": {
    "user_id": "5b2c…-uuid",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "+1555…",
    "birth_date": "1990-01-01T00:00:00Z",
    "gender": "female",
    "role": "customer",
    "created_at": "2026-06-11T10:00:00Z",
    "national_code": "1234567890",
    "oauth_provider": "google",
    "is_active": true,
    "email_verified_at": "2026-06-11T10:05:00Z",
    "last_login_at": "2026-06-11T12:00:00Z",
    "updated_at": "2026-06-11T12:00:00Z"
  }
}
```

Nullable fields (`first_name`, `last_name`, `phone`, `birth_date`, `gender`, `national_code`, `oauth_provider`, `email_verified_at`, `last_login_at`) are omitted when null.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS` (malformed UUID), `404 USER_NOT_FOUND`.

---

## Update a user

```
PATCH /admin/users/:userID
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated. Any `password_hash` in the body is **ignored** — password changes go through the [reset flow](../authentication.md#password-reset-flow).

This route accepts the same editable profile fields as [`/auth/me`](./auth.md) **plus two privileged, admin-only fields** — `role` and `is_active` — which are not bindable on the self-service route. Both are optional, so an admin can patch profile data without touching access control. Setting `is_active: true` here is also how a deactivated account is **reactivated** (existence is not pre-filtered on the active flag for this route).

**Request body** — `AdminUpdateUserReq`:

| Field | Type | Validation |
|-------|------|------------|
| `first_name` | string | |
| `last_name` | string | |
| `phone` | string | |
| `national_code` | string | |
| `birth_date` | string (date-time) | |
| `gender` | string | one of `male` `female` `other` |
| `role` | string | 🛡️ admin-only · one of `customer` `admin` `vendor` |
| `is_active` | bool | 🛡️ admin-only |

```json
{
  "role": "vendor",
  "is_active": true
}
```

> **Self lock-out guard.** An admin may **not** strip their own `admin` role or set
> their own `is_active` to `false`. If the caller's id equals `:userID` and the body
> would demote or deactivate them, the request is rejected with `403 ACCESS_DENIED`
> before any write — this prevents an admin from locking themselves (and potentially
> every admin) out of the console.

**Response** `200 OK` — updated `UserAdminResponse`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS` / `ACCESS_DENIED` (self lock-out), `400 INVALID_PARAMS`, `422 VALIDATION_ERROR`, `404 USER_NOT_FOUND`.

---

## Delete a user

```
DELETE /admin/users/:userID
Authorization: Bearer <access_token>
```

**Response** `204 No Content`.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_PARAMS`, `404 USER_NOT_FOUND`.
