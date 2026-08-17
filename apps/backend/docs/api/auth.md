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
| POST | `/auth/otp/request` | 🌐 public | Request SMS login OTP |
| POST | `/auth/otp/verify` | 🌐 public | Verify SMS login OTP and issue tokens |
| GET | `/auth/me` | 🔒 customer | Current user's profile |
| PATCH | `/auth/me` | 🔒 customer | Update own profile (phone is staged, not saved) |
| POST | `/auth/me/phone/otp` | 🔒 customer | Send OTP to a **new** phone number |
| POST | `/auth/me/phone/verify` | 🔒 customer | Verify that OTP and persist the new number |

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

Unknown emails and OTP-only (no password hash) accounts still run a bcrypt
compare against a dummy cost-12 hash, so a miss takes the same time as a
wrong-password miss. Response body and status are identical in both cases.

**Errors:** `401 INVALID_CREDENTIALS` (wrong email *or* password — never disclosed which), `403 FORBIDDEN` (account inactive or banned), `429 TOO_MANY_REQUESTS` (per-IP limiter, 10/min, shared with register / forgot / OTP / refresh / logout / password validate).

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

**Errors:** `401 INVALID_TOKEN`, `403 FORBIDDEN` (account inactive or banned), `429 TOO_MANY_REQUESTS` (same per-IP limiter as login).

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

**Errors:** `401 INVALID_TOKEN` (missing / malformed / wrong-purpose token), `500` (whitelist write failed), `429 TOO_MANY_REQUESTS` (same per-IP limiter as login).

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

A new `phone` is **not** written on this request (PR-040i). Other profile fields still save. The current number remains on the account until `POST /auth/me/phone/otp` + `POST /auth/me/phone/verify` succeed for that new number. Submitting the current number is a no-op. Admin `PATCH /admin/users/:userID` may still set phone without OTP.

| Field | Type | Validation |
|-------|------|------------|
| `first_name` | string | |
| `last_name` | string | |
| `phone` | string | Iranian mobile; staged only — see phone-change OTP |
| `national_code` | string | |
| `birth_date` | string (date-time) | |
| `gender` | string | one of `male` `female` `other` |

**Response** `200 OK` — updated `UserResponse` when no phone change was requested.

**Response** `202 Accepted` when a new phone was supplied — same profile fields (still the old number) plus `pending_phone`:

```json
{
  "data": {
    "user_id": "5b2c…-uuid",
    "first_name": "Jane",
    "email": "jane@example.com",
    "phone": "09120000000",
    "role": "customer",
    "created_at": "2026-06-11T10:00:00Z",
    "pending_phone": "09121111111"
  }
}
```

**Errors:** `401 UNAUTHORIZED`, `409 CONFLICT` (new number already bound to another account), `400 INVALID_REQUEST` (malformed phone), `422 VALIDATION_ERROR`.

---

## SMS OTP login

```
POST /auth/otp/request
```

Always returns `202 Accepted` once the phone is a well-formed Iranian mobile (enumeration-safe). Codes are stored in Redis (`OTP_TTL`, default 2m) and sent via the notification dispatcher / SMS gateway. Per-phone cap: 5 sends/hour (fail-closed). Shared per-IP limiter: 10/min.

```
POST /auth/otp/verify
```

| Field | Type | Required |
|-------|------|----------|
| `phone` | string | ✓ |
| `code` | string | ✓ 6 digits |

On success issues a token pair and, on first use, creates a phone-only customer. Wrong/expired/missing codes return `401 INVALID_CREDENTIALS`. Verify attempts are capped at 5 per code.

---

## Phone-change OTP

Changing the signed-in account's phone requires proving control of the **new** number. Login OTP (`/auth/otp/*`) must not be used for this — a phone-change code cannot be consumed as a login, and a login code cannot bind a number.

### Request

```
POST /auth/me/phone/otp
Authorization: Bearer <access_token>
```

| Field | Type | Required |
|-------|------|----------|
| `phone` | string | ✓ Iranian mobile (canonicalised server-side) |

Sends a 6-digit code to that number using the same OTP stack as login (generate, Redis TTL, per-phone 5/hour send cap via `otp:send:`, 5 verify tries, `DispatchOTP` purpose `phone_change`). Does not persist `users.phone`.

**Response** `202 Accepted`.

**Errors:** `400 INVALID_FIELD` (malformed or already the current number), `409 CONFLICT` (another account owns it), `429 TOO_MANY_REQUESTS`, `503 SERVICE_UNAVAILABLE` (no Redis).

### Verify

```
POST /auth/me/phone/verify
Authorization: Bearer <access_token>
```

| Field | Type | Required |
|-------|------|----------|
| `phone` | string | ✓ same new number |
| `code` | string | ✓ 6 digits |

The pending number from the request step must match. On success the code is burned and `users.phone` is updated.

**Response** `200 OK` — `UserResponse` with the new `phone`.

**Errors:** `401 INVALID_CREDENTIALS` (no pending change, wrong/expired code), `409 CONFLICT`, `429 TOO_MANY_REQUESTS`.

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

**Response** `200 OK` → `{ "data": { "valid": true } }`. **Errors:** `400 INVALID_QUERY`, `401 INVALID_TOKEN`/`EXPIRED_TOKEN`, `429 TOO_MANY_REQUESTS` (same per-IP limiter as login).

### Reset

```
POST /auth/password/reset
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `token` | string | ✓ | |
| `new_password` | string | ✓ | min 8 chars |

**Response** `200 OK` → `{ "data": { "message": "password updated" } }`. **Errors:** `422 VALIDATION_ERROR`, `401 INVALID_TOKEN`, `429 TOO_MANY_REQUESTS` (same per-IP limiter as login).
