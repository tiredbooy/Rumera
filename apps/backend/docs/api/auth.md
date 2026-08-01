# Auth

Registration, login, token refresh, profile, and password reset.

See [Authentication](../authentication.md) for the token model and trust tiers, and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | 🌐 public | Create a customer account |
| POST | `/auth/login` | 🌐 public | Exchange credentials for tokens |
| POST | `/auth/refresh` | 🌐 public | Mint a new token pair |
| POST | `/auth/logout` | 🌐 public | Revoke a refresh token |
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

Creates a customer account and returns credentials. The `role` field is ignored — new accounts are always `customer`.

**Request body**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✓ | valid email |
| `password` | string | ✓ | min 8 chars, max 72 UTF-8 bytes |
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

If the account commit succeeds but a configured refresh whitelist becomes
unavailable during credential issuance, the response still returns the
short-lived `access_token` and user but omits `refresh_token`. The client should
use normal login to establish a refreshable session; an unwhitelisted refresh
token is never advertised.

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

**Errors:** `401 INVALID_CREDENTIALS` (wrong email *or* password — never disclosed which), `403 FORBIDDEN` (account inactive or banned).

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

The user's current role and active status are re-read before rotation. Protected
requests also rehydrate this state, so access changes apply on the next request
without waiting for refresh.

When Redis is configured, refresh JTIs are whitelisted and replaced atomically.
One concurrent request commits the old-to-new handoff; retries during a
10-second race window receive the identical replacement pair, preventing
response ordering from corrupting a session cookie. The replay remains valid
only while its replacement JTI is still whitelisted. Token issuance and
revocation fail closed if the configured whitelist is unavailable.

**Errors:** `401 INVALID_TOKEN`, `403 FORBIDDEN` (account inactive or banned).

---

## Logout

```
POST /auth/logout
```

**Request body**

```json
{ "refresh_token": "…" }
```

Returns `204 No Content`. When Redis is configured, logout atomically consumes
each replay link from the supplied token and removes the currently active
replacement from the whitelist. A whitelist failure returns `500` rather than
claiming successful revocation. Access tokens remain short-lived and every
protected use is still checked against the live account state. A missing,
malformed, or wrong-purpose token returns `401 INVALID_TOKEN`; repeating logout
with a valid already-revoked token remains idempotent.

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
