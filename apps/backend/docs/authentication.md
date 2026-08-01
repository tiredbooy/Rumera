# Authentication & Authorization

The API uses **stateless JWT** access/refresh tokens with **role-based** access control.

## Token flow

```
 register / login
        │
        ▼
 ┌──────────────────────────┐
 │ access_token  (15 min)   │  ── sent as: Authorization: Bearer <token>
 │ refresh_token (7 days)   │  ── used to mint a new pair when access expires
 └──────────────────────────┘
        │
   access expires
        │
        ▼
 POST /auth/refresh  ──►  new access_token + refresh_token
```

1. **Register** (`POST /auth/register`) or **Login** (`POST /auth/login`) → returns a token pair.
2. Send the access token on every protected request: `Authorization: Bearer <access_token>`.
3. When the access token expires (`401 INVALID_TOKEN`), call **`POST /auth/refresh`** with the refresh token to get a fresh pair.
4. Every protected request re-reads the user's active status and role, so role or
   status changes take effect on the **next request**. Refresh also reads the
   current user before issuing a new pair.

See the [Auth API reference](./api/auth.md) for request/response shapes.

## Token contents

Access tokens are signed with HS256 and carry both user identifiers plus the role:

```json
{
  "uid": 42,                                      // internal users.id (int64)
  "user_id": "5b2c…-uuid",                        // public users.user_id
  "role": "customer",
  "sub": "5b2c…-uuid",
  "exp": 1718200000,
  "iat": 1718199100
}
```

`uid` and `user_id` bind the token to one database row. The role claim is a
session snapshot only: protected middleware looks up `uid`, verifies that the
  live UUID matches, rejects inactive or banned accounts, and injects the live `users.role`
into request context. Configured by `JWT_SECRET`, `JWT_ACCESS_TTL`,
`JWT_REFRESH_TTL` (TTLs in **minutes**).

### Refresh-token rotation & revocation (Redis-backed)

When Redis is configured, refresh tokens are backed by a server-side **whitelist**
keyed on their `jti`:

- **Rotation** — every `POST /auth/refresh` invalidates the presented refresh
  token and issues a new pair. Concurrent retries within a 10-second replay
  window receive the same replacement pair; later replays return
  `401 INVALID_TOKEN`.
- **Revocation** — `POST /auth/logout` (with the refresh token in the body)
  consumes its replay chain and deletes the active replacement `jti`, immediately
  killing the refreshable session.
- **Expiry** — whitelist entries carry the same TTL as the token.

Without Redis the system degrades to plain stateless refresh tokens (no rotation
or revocation) so local development still works.

### Brute-force protection

`POST /auth/login`, `/auth/register`, and `/auth/password/forgot` are rate-limited
per client IP (fixed window, Redis-backed). Exceeding the limit returns
`429 TOO_MANY_REQUESTS` with a `Retry-After` header.

## Trust tiers

Routes are organised into three tiers. Each tier is a Gin route group with its own middleware stack ([`internal/routes/routes.go`](../internal/routes/routes.go)).

| Tier | Middleware | Who | Examples |
|------|-----------|-----|----------|
| **Public** | none | anyone | Browse products, categories, brands, blogs, read reviews |
| **Customer** | `Auth` | any live, active logged-in user | Orders, addresses, wishlist, wallet, write reviews |
| **Admin** | `Auth` + `RequireRole("admin")` | live `users.role = admin` | Create/edit catalogue, manage orders, inventory, analytics |

### Middleware

- **`Auth`** — validates the bearer access token, loads the user by `uid`, checks
  the token UUID against the row, rejects inactive, banned, or missing users, then injects
  the live `uid`, `userID`, and `role`. Database failures fail closed with `500`.
- **`OptionalAuth`** — performs the same live rehydration when a token is present,
  but treats stale, inactive, or banned identities as anonymous.
- **`RequireRole(roles…)`** — must run after `Auth`; rejects callers whose role isn't in the allow-list with `403 INSUFFICIENT_PERMISSIONS`.

Defined in [`internal/middlewares/auth.go`](../internal/middlewares/auth.go).

## Roles

| Role | Description |
|------|-------------|
| `customer` | Default for all self-registrations. Can shop and manage their own data. |
| `admin` | Full management access to the `/admin` surface. |
| `vendor` | Reserved (accepted by the user model; no dedicated routes yet). |

> **Security:** `POST /auth/register` always forces `role=customer`. An admin account must be provisioned out-of-band (seed/migration) or promoted by an existing admin via `PATCH /admin/users/:userID`.

`users.role` is the sole authorization source. The assignable set is exactly
`customer`, `vendor`, and `admin`; only `admin` has admin-route access. There are
no effective permission, multi-role, manager, or support-role assignments. The
legacy RBAC tables remain in the schema for data preservation but are not read by
runtime authorization.

## Password reset flow

Self-service, enumeration-safe:

1. `POST /auth/password/forgot` with an email → always `202` (never reveals whether the email exists).
2. User receives a reset token (out-of-band, e.g. email).
3. `GET /auth/password/validate?token=…` → checks the token is still valid.
4. `POST /auth/password/reset` with `{token, new_password}` → sets the new password.

Passwords are hashed with **bcrypt (cost 12)** and are limited to bcrypt's
72-byte UTF-8 input boundary; the server never stores or accepts
plaintext-equivalent hashes from clients. See [`pkg/crypto`](../pkg/crypto/crypto.go).

## Worked example

```bash
# 1. Login
TOKENS=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"supersecret"}')

ACCESS=$(echo "$TOKENS" | jq -r .data.access_token)

# 2. Call a protected endpoint
curl http://localhost:8080/api/v1/wallet \
  -H "Authorization: Bearer $ACCESS"

# 3. Refresh when the access token expires
REFRESH=$(echo "$TOKENS" | jq -r .data.refresh_token)
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refresh_token\":\"$REFRESH\"}"
```
