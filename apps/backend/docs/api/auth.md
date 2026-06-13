# Auth

Registration, login, token refresh, profile, and password reset.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | 🌐 public | Create a customer account |
| POST | `/auth/login` | 🌐 public | Exchange credentials for tokens |
| POST | `/auth/refresh` | 🌐 public | Mint a new token pair |
| POST | `/auth/logout` | 🌐 public | Client-side logout (no-op) |
| POST | `/auth/password/forgot` | 🌐 public | Start password reset |
| GET | `/auth/password/validate` | 🌐 public | Validate a reset token |
| POST | `/auth/password/reset` | 🌐 public | Set a new password |
| GET | `/auth/me` | 🔒 customer | Current user's profile |
| PATCH | `/auth/me` | 🔒 customer | Update own profile |

---

## Register

```
POST /auth/register
```

Creates a customer account and returns a token pair. The `role` field is ignored — new accounts are always `customer`.

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✓ | valid email |
| `password` | string | ✓ | min 8 chars |
| `first_name` | string | | |
| `last_name` | string | | |
| `phone` | string | | |
| `national_code` | string | | |
| `birth_date` | string (date-time) | | |
| `gender` | string | | one of `male` `female` `other` |

```json
{
  "email": "jane@example.com",
  "password": "supersecret",
  "first_name": "Jane"
}
```

**Response** `201 Created`

```json
{
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "user": {
      "user_id": "5b2c…-uuid",
      "first_name": "Jane",
      "email": "jane@example.com",
      "role": "customer",
      "created_at": "2026-06-11T10:00:00Z"
    }
  }
}
```

**Errors:** `422 VALIDATION_ERROR`, `409 USER_ALREADY_EXISTS`.

---

## Login

```
POST /auth/login
```

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | ✓ (valid email) |
| `password` | string | ✓ |

**Response** `200 OK` — same `AuthResponse` shape as register (`access_token`, `refresh_token`, `user`).

**Errors:** `401 INVALID_CREDENTIALS` (wrong email *or* password — never disclosed which), `403 FORBIDDEN` (account inactive).

---

## Refresh

```
POST /auth/refresh
```

**Request body**

| Field | Type | Required |
|-------|------|----------|
| `refresh_token` | string | ✓ |

**Response** `200 OK`

```json
{ "data": { "access_token": "…", "refresh_token": "…" } }
```

The user's current role is re-read, so role changes apply from the next refresh onward.

**Errors:** `401 INVALID_TOKEN`, `403 FORBIDDEN` (account inactive).

---

## Logout

```
POST /auth/logout
```

Stateless JWTs can't be server-revoked yet, so this is a **no-op** that returns `204 No Content`. The client should discard its tokens. The endpoint exists so revocation can be added later without an API change.

---

## Get current profile

```
GET /auth/me
Authorization: Bearer <access_token>
```

**Response** `200 OK` — `UserResponse`:

```json
{
  "data": {
    "user_id": "5b2c…-uuid",
    "first_name": "Jane",
    "email": "jane@example.com",
    "phone": "+1555…",
    "role": "customer",
    "created_at": "2026-06-11T10:00:00Z"
  }
}
```

**Errors:** `401 UNAUTHORIZED`.

---

## Update own profile

```
PATCH /auth/me
Authorization: Bearer <access_token>
```

All fields optional; only supplied fields are updated. Password changes go through the reset flow — any `password_hash` in the body is ignored.

| Field | Type | Validation |
|-------|------|------------|
| `first_name` | string | |
| `last_name` | string | |
| `phone` | string | |
| `national_code` | string | |
| `birth_date` | string (date-time) | |
| `gender` | string | one of `male` `female` `other` |

**Response** `200 OK` — updated `UserResponse`. **Errors:** `401 UNAUTHORIZED`, `422 VALIDATION_ERROR`.

---

## Password reset

### Forgot

```
POST /auth/password/forgot
```

| Field | Type | Required |
|-------|------|----------|
| `email` | string | ✓ (valid email) |

Always returns `202 Accepted` regardless of whether the email exists (prevents account enumeration):

```json
{ "data": { "message": "if the email exists, a reset link has been sent" } }
```

### Validate token

```
GET /auth/password/validate?token=<token>
```

**Response** `200 OK` → `{ "data": { "valid": true } }`. **Errors:** `400 INVALID_QUERY`, `401 INVALID_TOKEN`/`EXPIRED_TOKEN`.

### Reset

```
POST /auth/password/reset
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `token` | string | ✓ | |
| `new_password` | string | ✓ | min 8 chars |

**Response** `200 OK` → `{ "data": { "message": "password updated" } }`. **Errors:** `422 VALIDATION_ERROR`, `401 INVALID_TOKEN`.
