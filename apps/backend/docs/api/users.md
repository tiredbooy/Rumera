# Users and roles (admin)

The admin API re-reads the account's current role, capabilities, and
active/ban status from the database. Panel entry is a live, active, non-banned
`admin` or `staff`. HTTP then applies `RequirePermission`:

| Surface | Grant |
|---------|--------|
| List / get / audit / roles | `customers:read` ∨ `customers:write` ∨ `roles:manage` |
| Create / profile PATCH / deactivate | `customers:write` (role / `is_active` / DELETE also need live `role=admin`) |
| Ban / unban | `customers:ban` (not `customers:write`) |

Admin superuser always passes the capability check. The public `:userID`
parameter is `users.user_id` (UUID), not the internal integer ID.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/roles` | Supported roles, access policy, and live member counts |
| GET | `/admin/users` | List active and inactive users |
| POST | `/admin/users` | Create a user without creating a session |
| GET | `/admin/users/:userID` | Fetch a user, including inactive users |
| PATCH | `/admin/users/:userID` | Update profile, role, or active status |
| DELETE | `/admin/users/:userID` | Soft-deactivate a user |
| POST | `/admin/users/:userID/ban` | Ban an account (`customers:ban`) |
| POST | `/admin/users/:userID/unban` | Clear a ban (`customers:ban`) |
| GET | `/admin/users/:userID/audit` | Read newest-first admin audit events |

All routes require `Authorization: Bearer <access_token>`. The role snapshot in
the token is not trusted for authorization.

## Authorization model

```
GET /admin/roles
```

**Response** `200 OK`:

```json
{
  "data": {
    "authorization_mode": "role_capabilities",
    "admin_roles": ["admin", "staff"],
    "roles": [
      {
        "role": "customer",
        "admin_access": false,
        "assignable": true,
        "member_count": 120,
        "active_member_count": 117
      },
      {
        "role": "vendor",
        "admin_access": false,
        "assignable": true,
        "member_count": 4,
        "active_member_count": 3
      },
      {
        "role": "admin",
        "admin_access": true,
        "assignable": true,
        "member_count": 2,
        "active_member_count": 2
      },
      {
        "role": "staff",
        "admin_access": true,
        "assignable": true,
        "member_count": 3,
        "active_member_count": 3
      }
    ]
  }
}
```

The role order is always `customer`, `vendor`, `admin`, `staff`. Panel entry is
`admin` (superuser) or `staff` (capability-gated). Assigning `users.role` and
toggling `is_active` still require a live `admin`. Legacy RBAC tables remain
untouched but are not consulted at runtime; migration refuses unsupported
`users.role` values so operators must reconcile them explicitly.

## Create a user

```
POST /admin/users
Content-Type: application/json
```

`email` and `password` are required. Passwords must be 8 to 72 UTF-8 bytes, which
matches bcrypt's authoritative input limit. Profile fields, `role`, and
`is_active` are optional. `role` defaults to `customer`; `is_active` defaults to
`true`.

```json
{
  "email": "vendor@example.com",
  "password": "at-least-8-characters",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+15550000000",
  "national_code": "1234567890",
  "birth_date": "1990-01-01T00:00:00Z",
  "gender": "female",
  "role": "vendor",
  "is_active": true
}
```

The server hashes the password with bcrypt. This operation returns no access or
refresh token and does not award signup loyalty points.

**Response** `201 Created` with the `AdminUser` projection documented below.

**Errors:** `409 CONFLICT` for any duplicate email, phone, or national-code
identity; `422 VALIDATION_ERROR` for an invalid body.

## List users

```
GET /admin/users
```

No status filter means **all users**, active and inactive. Supported query
parameters:

| Parameter | Values |
|-----------|--------|
| `page`, `limit` | Standard pagination (`limit` max 100) |
| `search` | Partial first name, last name, email, or phone |
| `role` | `customer`, `vendor`, `admin`, `staff` |
| `is_active` | `true` means active and non-banned; `false` includes inactive or banned accounts |
| `gender` | `male`, `female`, `other` |
| `created_from`, `created_to` | RFC 3339 timestamps |
| `sortBy` | `created_at`, `email`, `first_name`, `last_name` |
| `orderBy` | `asc`, `desc` |

**Response** `200 OK` uses the standard paginated envelope. Each result contains
`user_id`, `full_name`, `email`, optional `phone`, `role`, `total_orders`,
`is_active`, `is_banned`, and `created_at`. A banned row may retain
`is_active=true`, but it cannot authenticate and is counted in the inactive
filter and excluded from active role counts.

## Get a user

```
GET /admin/users/:userID
```

Inactive users remain addressable. **Response** `200 OK`:

```json
{
  "data": {
    "user_id": "5b2c0000-0000-0000-0000-000000000000",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "+15550000000",
    "birth_date": "1990-01-01T00:00:00Z",
    "gender": "female",
    "role": "customer",
    "created_at": "2026-06-11T10:00:00Z",
    "national_code": "1234567890",
    "is_active": false,
    "is_banned": false,
    "updated_at": "2026-07-28T10:00:00Z"
  }
}
```

Password hashes and internal database IDs are never returned.

## Update a user

```
PATCH /admin/users/:userID
Content-Type: application/json
```

All fields are optional. Profile fields support three PATCH states: omitted
means unchanged, a value means replace, and explicit JSON `null` means clear.
Unlike self-service `PATCH /auth/me`, an admin (or staff with `customers:write`)
may set `phone` immediately — no OTP. Customers must prove the new number
(`POST /auth/me/phone/otp` then `/verify`; PR-040i).

| Field | Accepted value |
|-------|----------------|
| `first_name`, `last_name`, `phone`, `national_code` | string or `null` |
| `birth_date` | RFC 3339 timestamp or `null` |
| `gender` | `male`, `female`, `other`, or `null` |
| `role` | `customer`, `vendor`, `admin`, `staff` |
| `is_active` | boolean |

Explicit JSON `null` is rejected for `role` and `is_active`; omission means no
change. Ban state is returned as `is_banned`/`banned_at` and is **not** writable
here — use `POST /admin/users/:userID/ban` and `/unban`. Toggling `is_active`
does not clear a ban.

```json
{
  "phone": null,
  "role": "vendor",
  "is_active": true
}
```

An admin cannot demote or deactivate their own account. This rule is enforced in
the service and again inside the repository transaction; the actor is locked and
revalidated as an active admin before the target write.

**Response** `200 OK` with the updated `AdminUser`.

## Deactivate a user

```
DELETE /admin/users/:userID
```

Deletion is a soft deactivation (`users.is_active=false`). Repeating it for an
already inactive target is idempotent. An admin cannot delete their own account.

**Response** `204 No Content`.

## Ban a user

```
POST /admin/users/:userID/ban
```

Requires `customers:ban` (admin superuser always allowed). No request body.
Sets `is_banned=true`, `banned_at=now()`, and bumps `sessions_invalidated_at`
so existing JWTs die immediately. Auth already rejects `IsBanned` on every
request; the session bump is defense in depth.

`is_active` is unchanged: a banned row may stay `is_active=true` and still
cannot authenticate. Repeating the call on an already-banned target is
idempotent and does not write another audit event.

An operator cannot ban their own account. Banning the last active, non-banned
`admin` returns `409 CONFLICT`.

**Response** `200 OK` with the updated `AdminUser`.

## Unban a user

```
POST /admin/users/:userID/unban
```

Requires `customers:ban`. Clears `is_banned` and `banned_at`. Does not
reactivate an inactive account and does not clear `sessions_invalidated_at` —
the user must sign in again. Repeating the call on an already-unbanned target
is idempotent. Self-unban is denied.

**Response** `200 OK` with the updated `AdminUser`.

## User audit history

```
GET /admin/users/:userID/audit?page=1&limit=20
```

Events are newest-first and use the standard paginated envelope:

```json
{
  "results": [
    {
      "event_id": "6cd70000-0000-0000-0000-000000000000",
      "actor_user_id": "8fb10000-0000-0000-0000-000000000000",
      "actor_email": "admin@example.com",
      "target_user_id": "5b2c0000-0000-0000-0000-000000000000",
      "action": "user.updated",
      "changed_fields": ["phone", "role", "is_active"],
      "changes": {
        "role": {"before": "customer", "after": "vendor"},
        "is_active": {"before": true, "after": false}
      },
      "created_at": "2026-07-28T10:00:00Z"
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

`action` is one of `user.created`, `user.updated`, or `user.deactivated`.
Ban and unban emit `user.updated` (the audit table's action check does not
have dedicated ban verbs). `changed_fields` may name profile fields, but
`changes` stores before/after values only for `role`, `is_active`, and
`is_banned`. Email, password, phone, national code, names, birth date, and
gender values are never stored in the audit JSON.

## Common errors

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `INVALID_REQUEST` / `INVALID_PARAMS` | Invalid filter, role, gender, date range, or UUID |
| 401 | `MISSING_TOKEN` / `INVALID_TOKEN` | Missing token, stale identity, or inactive/banned account |
| 403 | `INSUFFICIENT_PERMISSIONS` | Missing capability (or live role is not a panel operator) |
| 403 | `ACCESS_DENIED` | Self-demotion, self-deactivation, self-delete, or self-ban/unban |
| 404 | `USER_NOT_FOUND` | Target UUID does not exist |
| 409 | `CONFLICT` | Duplicate identity, or last-admin lockout (demote / deactivate / ban) |
| 422 | `VALIDATION_ERROR` | Invalid JSON body fields |
