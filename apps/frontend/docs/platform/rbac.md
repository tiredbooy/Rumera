# Admin authorization and frontend capabilities

Rumera has one runtime authorization source: the live `users.role` value in the
Go backend. The frontend capability layer organizes the admin UI, but it is not
an independent security boundary.

> **Rule:** only a live, active, non-banned user with panel role **`admin` or
> `staff`** may enter the admin surface. Backend enforces capability IDs via
> `RequirePermission`. Never trust a stale JWT role or a FE-only `can()` check.

## Supported roles

Panel roles (backend + FE):

| Role       | Persian label | Admin access | Notes |
| ---------- | ------------- | :----------: | ----- |
| `customer` | مشتری         |      no      | Default public registration |
| `vendor`   | فروشنده       |      no      | Domain role; no vendor admin |
| `admin`    | مدیر کل       |     yes      | Superuser — all capabilities |
| `staff`    | همکار         |     yes      | Capability grants only (PH-021) |

Capability catalogue: `lib/rbac/permissions.ts` ⇔ `features/rbac` model.  
Full BE matrix: `apps/backend/docs/architecture/rbac.md` (PH-021a).

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
Go backend then applies `Auth + RequireRole(admin|staff) + RequirePermission`.

### Backend

The complete `/api/v1/admin` group is protected at the group level:

```go
admin := v1.Group("/admin")
admin.Use(mw.Auth(jwt, h.User), mw.RequireRole("admin", "staff"))
// per surface: with("inventory:write") — write routes do not accept read-only
```

`Auth` verifies the JWT and rehydrates the numeric ID, public UUID, role, active
state, and ban state from the database. `RequireRole` / `RequirePermission`
consume that live role and capability grants (see `architecture/rbac.md`).

## User and role administration

`GET /admin/roles` is the role screen's source. It returns:

- `authorization_mode: "single_role"`;
- `admin_roles: ["admin"]`;
- deterministic `customer`, `vendor`, `admin` entries;
- live member and active non-banned member counts;
- whether each supported role is assignable and whether it grants admin access.

`POST/PATCH/DELETE /admin/users` operations are transactional and audited.
Self-demotion, self-deactivation, and self-delete are rejected (**403**).
Demoting or deactivating the **last active admin** is rejected (**409 CONFLICT**
— PH-021b). FE surfaces a clear Persian message. Ban / unban is
`POST /admin/users/:id/ban|unban` behind **`customers:ban`** only
(PR-040e / PR-064b). The customer detail action is hidden without that
cap and never offered for the signed-in operator. Reactivation still
does not clear a ban.

**Mid-session capability revoke:** Auth rehydrates role/status every request;
`RequirePermission` reads live grants. Staff whose grants were cleared get 403
on the next API call; reload the roles matrix or refresh session for nav.

The legacy `roles`, `permissions`, `user_roles`, and `role_permissions` tables
remain in the schema to preserve deployed data. Runtime authorization does not
read them, and migrations do not silently rewrite or drop them.

## Tags, coupons, shipping page gates

`requireTagAdmin` / `requireCouponAdmin` / `requireShippingAdmin` are thin
wrappers around `requirePermission` with `tags:manage` / `coupons:manage` /
`shipping:manage`. They do **not** check `session.role === "admin"`.

Seed staff defaults (`STAFF_DEFAULTS`) and sidebar nav already grant those
capabilities; the Go write routes use the same IDs. A staff operator with the
grant can open `/admin/tags`, `/admin/coupons`, and `/admin/shipping`. Admin
superuser still passes because `can()` / live permissions give admin the full
catalogue. Staff without the grant (or any non-panel role) still lands on
`/forbidden`.

Page imports keep the `require*Admin` names so existing routes stay valid.

## Product editor write gate

`/admin/products/[id]` stays on `requirePermission(PRODUCTS_READ)` so staff who
can list the catalogue can still **open** the editor. The page computes
`canWrite = can(session, PRODUCTS_WRITE)` the same way as the product list and
passes it into `ProductEditView` → `ProductForm`.

- Create (`/admin/products/new`) still requires `PRODUCTS_WRITE` at the page
  guard; `ProductCreateView` always passes `canWrite`.
- When `canWrite` is false the form is view-only: submit is hidden, image
  upload and variant generators that mutate are disabled, and
  `saveProductAggregate` is not called. A short Persian status explains the
  read-only mode.
- Do **not** 403 the whole edit page for readers. Backend write routes still
  require `products:write` — hiding the button is UX, not the security
  boundary.

## Category and recipe editor write gates

Same pattern as the product editor (PR-061d).

- `/admin/categories/[id]` stays on `requirePermission(PRODUCTS_READ)` so
  catalogue readers can **open** the editor. The page computes
  `canWrite = can(session, PRODUCTS_WRITE)` and passes it into
  `CategoryEditView` → `CategoryForm`.
- `/admin/recipes/[id]` stays on `requirePermission(RECIPES_READ)`.
  `canWrite = can(session, RECIPES_WRITE)` flows into
  `RecipeEditView` → `RecipeForm`.
- Create (`/admin/categories/new`, `/admin/recipes/new`) still requires
  write at the page guard; create views always pass `canWrite`.
- When `canWrite` is false the form is view-only: submit (and recipe
  delete) is hidden, image upload is disabled, and create/update/delete
  clients are not called. A short Persian “فقط مشاهده” status explains
  the mode.
- List boards already hide create / delete without write. Do **not** 403
  the edit page for readers. Backend write routes remain the security
  boundary.

## Journal detail and options list write gates

Same pattern as the product editor (PR-061e).

- `/admin/journal/[id]` is `requirePermission(JOURNAL_READ)` so journal
  readers can **open** a post. The page computes
  `canWrite = can(session, JOURNAL_WRITE)` and passes it into
  `JournalEditView` → `JournalForm`.
- `/admin/options` is `requirePermission(PRODUCTS_READ)`.
  `canWrite = can(session, PRODUCTS_WRITE)` flows into `OptionsBoard`.
  `/admin/options/[id]` stays on `PRODUCTS_READ` and passes `canWrite`
  into `OptionTypeForm`.
- Create (`/admin/journal/new`, `/admin/options/new`) still requires
  write at the page guard; create views always pass `canWrite`.
- When `canWrite` is false the journal form is view-only: submit is
  hidden, image upload is disabled, and create/update clients are not
  called. The options list hides create / edit / delete. Option values
  cannot be added or removed. A short Persian “فقط مشاهده” status
  explains the mode.
- Do **not** 403 journal detail or the options list for readers.
  Backend write routes remain the security boundary.

## Navigation

`ADMIN_NAV` declares each admin route once and `filterNav()` removes entries whose
frontend capability is absent. Both `admin` and `staff` reach the shell via
`requireStaff()`; nav and page guards then use the same capability IDs. Do not
re-check `role === "admin"` on a module that already has a capability (see tags /
coupons / shipping above).

`ACCOUNT_NAV` is separate and permission-free for authenticated account pages.

## Extending authorization

For a new admin module:

1. Add or reuse a frontend capability in `permissions.ts`.
2. Gate the nav item and server page with `requirePermission` (or a thin named
   wrapper). Never use `session.role === "admin"` as the page gate.
3. Add the backend route under the existing admin group or introduce explicit
   backend capability enforcement.
4. Add live authorization, route, and API tests.

Steps 1 and 2 only change UX. A new role or partial-admin policy is not supported
until the backend contract, migration policy, live role endpoint, server guards,
and tests all change together.
