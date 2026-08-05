# Admin authorization and frontend capabilities

Rumera has one runtime authorization source: the live `users.role` value in the
Go backend. The frontend capability layer organizes the admin UI, but it is not
an independent security boundary.

> **Rule:** only a live, active, non-banned user with `role=admin` may enter or
> call the admin surface. Never infer access from a stale JWT role or from a
> passing frontend `can()` check.

## Supported roles

`lib/rbac/roles.ts` mirrors the backend's constrained role set:

```ts
export type Role = "customer" | "vendor" | "admin";
```

| Role       | Persian label | Admin access | Notes                                                   |
| ---------- | ------------- | :----------: | ------------------------------------------------------- |
| `customer` | مشتری         |      no      | Default for every public registration.                  |
| `vendor`   | فروشنده       |      no      | Assignable domain role; no dedicated vendor routes yet. |
| `admin`    | مدیر کل       |     yes      | The only role accepted by backend admin middleware.     |

`isStaff(role)` is intentionally equivalent to `role === "admin"`. There are no
frontend `support` or `manager` roles.

## Capability catalogue

These files keep admin navigation and page affordances consistent:

```text
lib/rbac/
├── permissions.ts   frontend resource:action identifiers and labels
├── roles.ts         supported roles, labels, and role-to-capability mapping
├── nav.ts           sidebar declarations and permission filtering
└── can.ts           can(), hasAny(), and hasAll() predicates
```

The identifiers in `permissions.ts` are frontend capabilities, not rows fetched
from the dormant backend `permissions` table. `admin` receives the complete
catalogue; `customer` and `vendor` receive none.

```ts
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: [],
  vendor: [],
  admin: ALL,
};
```

The Auth.js session callback derives `session.permissions` from the role so all
frontend consumers share the same shape. That derivation only controls UX inside
an already admin-authorized boundary.

## Defense in depth

### Middleware

`proxy.ts` performs a cheap first pass for `/account` and `/admin`:

- missing session redirects to `/login` with the exact callback path;
- an expiring access token redirects to `/api/auth/refresh-session`, where the
  replacement Auth.js cookie can be persisted;
- private responses receive `X-Robots-Tag: noindex, nofollow`.

Middleware intentionally does not trust the JWT role for admin authorization.

### Server guards

`lib/auth/session.ts` owns the server-rendering checks:

| Guard                  | Check                                          | Failure                                      |
| ---------------------- | ---------------------------------------------- | -------------------------------------------- |
| `requireUser()`        | valid signed-in session                        | `/login`                                     |
| `requireStaff()`       | session plus live `/auth/me` role/status check | `/login`, `/forbidden`, or unavailable error |
| `requirePermission(p)` | live admin plus frontend capability            | `/forbidden`                                 |

`requireStaff()` replaces the session role and identity with the live backend
profile. A demotion, deactivation, ban, or deleted user therefore loses access on
the next request even while the encrypted session cookie still exists.

### Admin BFF

`app/api/admin/[...path]/route.ts` repeats the live `/auth/me` check before it
forwards a bearer token. The path helper rejects encoded separators, dot
segments, control characters, query/fragment injection, and origin changes. The
Go backend then repeats `Auth + RequireRole("admin")`.

### Backend

The complete `/api/v1/admin` group is protected at the group level:

```go
a := v1.Group("/admin")
a.Use(mw.Auth(jwt, h.User), mw.RequireRole("admin"))
```

`Auth` verifies the JWT and rehydrates the numeric ID, public UUID, role, active
state, and ban state from the database. `RequireRole` consumes that live role,
not the role claim embedded when the token was issued.

## User and role administration

`GET /admin/roles` is the role screen's source. It returns:

- `authorization_mode: "single_role"`;
- `admin_roles: ["admin"]`;
- deterministic `customer`, `vendor`, `admin` entries;
- live member and active non-banned member counts;
- whether each supported role is assignable and whether it grants admin access.

`POST/PATCH/DELETE /admin/users` operations are transactional and audited.
Self-demotion, self-deactivation, and self-delete are rejected. Existing ban
state is visible but read-only; the UI does not imply that reactivation clears a
ban.

The legacy `roles`, `permissions`, `user_roles`, and `role_permissions` tables
remain in the schema to preserve deployed data. Runtime authorization does not
read them, and migrations do not silently rewrite or drop them.

## Navigation

`ADMIN_NAV` declares each admin route once and `filterNav()` removes entries whose
frontend capability is absent. Since only `admin` reaches the shell today, this
primarily keeps page guards, navigation, and future backend capability work using
the same identifiers.

`ACCOUNT_NAV` is separate and permission-free for authenticated account pages.

## Extending authorization

For a new admin module:

1. Add or reuse a frontend capability in `permissions.ts`.
2. Gate the nav item and server page with that capability.
3. Add the backend route under the existing admin group or introduce explicit
   backend capability enforcement.
4. Add live authorization, route, and API tests.

Steps 1 and 2 only change UX. A new role or partial-admin policy is not supported
until the backend contract, migration policy, live role endpoint, server guards,
and tests all change together.
