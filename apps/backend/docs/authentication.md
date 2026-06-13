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
4. The refresh endpoint re-reads the user's current role, so **role changes take effect on the next refresh**.

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

Carrying both `uid` and `user_id` means user-scoped endpoints resolve the caller with **zero extra database lookups**. Configured by `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` (TTLs in **minutes**).

### Refresh-token rotation & revocation (Redis-backed)

When Redis is configured, refresh tokens are backed by a server-side **whitelist**
keyed on their `jti`:

- **Rotation** — every `POST /auth/refresh` invalidates the presented refresh
  token and issues a new pair. A refresh token is therefore single-use; replaying
  one returns `401 INVALID_TOKEN`.
- **Revocation** — `POST /auth/logout` (with the refresh token in the body)
  deletes its `jti`, immediately killing the session.
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
| **Customer** | `Auth` | any logged-in user | Orders, addresses, wishlist, wallet, write reviews |
| **Admin** | `Auth` + `RequireRole("admin")` | role = `admin` | Create/edit catalogue, manage orders, inventory, analytics |

### Middleware

- **`Auth`** — validates the bearer access token, then injects `uid` (int64), `userID` (uuid), and `role` into the request context. Rejects missing/invalid tokens with `401`.
- **`OptionalAuth`** — populates identity if a valid token is present, but never rejects. For endpoints that personalise output yet stay public.
- **`RequireRole(roles…)`** — must run after `Auth`; rejects callers whose role isn't in the allow-list with `403 INSUFFICIENT_PERMISSIONS`.

Defined in [`internal/middlewares/auth.go`](../internal/middlewares/auth.go).

## Roles

| Role | Description |
|------|-------------|
| `customer` | Default for all self-registrations. Can shop and manage their own data. |
| `admin` | Full management access to the `/admin` surface. |
| `vendor` | Reserved (accepted by the user model; no dedicated routes yet). |

> **Security:** `POST /auth/register` always forces `role=customer`. An admin account must be provisioned out-of-band (seed/migration) or promoted by an existing admin via `PATCH /admin/users/:userID`.

## Password reset flow

Self-service, enumeration-safe:

1. `POST /auth/password/forgot` with an email → always `202` (never reveals whether the email exists).
2. User receives a reset token (out-of-band, e.g. email).
3. `GET /auth/password/validate?token=…` → checks the token is still valid.
4. `POST /auth/password/reset` with `{token, new_password}` → sets the new password.

Passwords are hashed with **bcrypt (cost 12)**; the server never stores or accepts plaintext-equivalent hashes from clients. See [`pkg/crypto`](../pkg/crypto/crypto.go).

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
