# RBAC (Role-Based Access Control)

How the frontend decides who sees what in the admin console and account area —
and where that maps onto real backend enforcement.

> **One sentence to remember:** the frontend RBAC layer is **UX** (hide what you
> can't use, bounce early). The **backend `RequireRole` middleware is the real
> gate.** Never treat a passing `can()` check as a security guarantee.

The whole system lives in four small files:

```
lib/rbac/
├── permissions.ts   the catalogue  — every resource:action pair the app knows
├── roles.ts         role → permission[] map, Role type, isStaff(), labels
├── nav.ts           sidebar declarations + filterNav() permission gating
└── can.ts           can() / hasAny() / hasAll() predicates over a session
```

---

## Roles

Five roles are recognised by the backend; the frontend mirrors them in
`lib/rbac/roles.ts`:

```ts
export type Role = "customer" | "support" | "manager" | "admin" | "vendor"
```

| Role       | Persian label   | Staff? | Notes |
|------------|-----------------|:------:|-------|
| `customer` | مشتری           | no     | Default on self-registration; access scoped to own data, not the permission catalogue. |
| `vendor`   | فروشنده         | no     | Recognised but **currently has no permissions** (`vendor: []`). A placeholder. |
| `support`  | پشتیبانی        | yes    | Front-line: read orders/customers, read + moderate reviews. |
| `manager`  | مدیر فروشگاه    | yes    | Runs catalogue, inventory, orders, recipes, analytics day-to-day. |
| `admin`    | مدیر کل         | yes    | **All** permissions (`admin: ALL`). |

`isStaff(role)` is the gate for the `/admin` surface. Only `support`, `manager`,
and `admin` are staff:

```ts
const STAFF_ROLES = new Set<Role>(["support", "manager", "admin"])
export function isStaff(role) { return !!role && STAFF_ROLES.has(role) }
```

---

## The permission model

`lib/rbac/permissions.ts` is the **single source of truth** for what can be
done. Every entry is a `resource:action` string that mirrors a row in the
backend `permissions` table
(`apps/backend/migrations/main/20260525210307_create_permissions_table.sql`).

```ts
export const PERMISSIONS = {
  PRODUCTS_READ:   "products:read",
  PRODUCTS_WRITE:  "products:write",
  PRODUCTS_DELETE: "products:delete",
  INVENTORY_READ:  "inventory:read",
  INVENTORY_WRITE: "inventory:write",
  ORDERS_READ:     "orders:read",
  ORDERS_WRITE:    "orders:write",
  ORDERS_REFUND:   "orders:refund",
  CUSTOMERS_READ:  "customers:read",
  CUSTOMERS_WRITE: "customers:write",
  CUSTOMERS_BAN:   "customers:ban",
  REVIEWS_READ:    "reviews:read",
  REVIEWS_MODERATE:"reviews:moderate",
  RECIPES_READ:    "recipes:read",
  RECIPES_WRITE:   "recipes:write",
  HERO_MANAGE:     "hero:manage",
  ANALYTICS_READ:  "analytics:read",
  ROLES_MANAGE:    "roles:manage",
  SETTINGS_MANAGE: "settings:manage",
} as const
```

`Permission` is the union of those string values. `PERMISSION_LABELS` holds the
Persian (RTL) human-readable names used on the roles admin screen.

**Admin = ALL.** Permissions are never granted to `admin` one-by-one; the role
map just spreads the whole catalogue (`const ALL = Object.values(PERMISSIONS)`).
So adding a new permission automatically grants it to admin — no follow-up edit.

---

## Role → permission mapping

`lib/rbac/roles.ts` resolves a role to its permission list:

```ts
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: [],
  vendor:   [],
  support:  [ORDERS_READ, CUSTOMERS_READ, REVIEWS_READ, REVIEWS_MODERATE],
  manager:  [PRODUCTS_READ, PRODUCTS_WRITE, INVENTORY_READ, INVENTORY_WRITE,
             ORDERS_READ, ORDERS_WRITE, ORDERS_REFUND, CUSTOMERS_READ,
             REVIEWS_READ, REVIEWS_MODERATE, RECIPES_READ, RECIPES_WRITE,
             ANALYTICS_READ],
  admin:    ALL,
}
export function permissionsForRole(role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
```

### Why a map, and not the token?

The backend JWT currently carries a **single `role` string** and no resolved
permission set (see `apps/backend/docs/authentication.md`, token contents). So
the frontend derives permissions from the role at session-shaping time in
`lib/auth/auth.config.ts`:

```ts
session({ session, token }) {
  const role = (token.role as Role) ?? "customer"
  session.role = role
  session.permissions = permissionsForRole(role)   // ← derived here, once
  ...
}
```

Every downstream consumer — server guards, edge middleware, client components —
reads `session.permissions`, so they all agree on the same set. When the API
eventually embeds permissions in the token, you read them straight from the
session and `ROLE_PERMISSIONS` becomes the fallback.

---

## The `can()` helper

`lib/rbac/can.ts` is three pure predicates over anything carrying a
`permissions` array. They never re-derive from the role:

```ts
can(session, p)         // session holds permission p
hasAny(session, ...ps)  // holds at least one of ps
hasAll(session, ...ps)  // holds every one of ps
```

They are null-safe (`return !!session?.permissions?.includes(p)`), so passing an
unauthenticated/undefined session simply yields `false`.

### Usage in pages & components

Server pages enforce access with the guards in `lib/auth/session.ts`, then use
`can()` to toggle write affordances on the **already-authorised** session:

```tsx
// app/admin/orders/[id]/page.tsx
const session   = await requirePermission(PERMISSIONS.ORDERS_READ) // gate (redirects)
const canWrite  = can(session, PERMISSIONS.ORDERS_WRITE)           // UI toggle
const canRefund = can(session, PERMISSIONS.ORDERS_REFUND)
```

```tsx
// app/admin/customers/[id]/page.tsx
const session  = await requirePermission(PERMISSIONS.CUSTOMERS_READ)
const canWrite = can(session, PERMISSIONS.CUSTOMERS_WRITE)
// …later: {canWrite ? <Button asChild><Link …>ویرایش کاربر</Link></Button> : null}
```

Pattern: **`requirePermission` is the gate** (it `redirect()`s on failure, which
throws, so control never returns). **`can()` is for in-page conditionals** —
showing an Edit button, a Refund action, etc. The same `can()` also powers nav
filtering (below).

---

## Server guards (`lib/auth/session.ts`)

These are the authoritative **server-side** checks. Each redirects on failure
and returns a narrowed, non-null session on success:

| Guard                         | Checks                                   | On failure |
|-------------------------------|------------------------------------------|------------|
| `requireUser()`               | signed in                                | → `/login?callbackUrl=…` |
| `requireStaff()`              | signed in **and** `isStaff(role)`        | → `/login` or `/forbidden` |
| `requirePermission(p)`        | `requireStaff()` **and** `can(session,p)`| → `/login` or `/forbidden` |

The admin shell (`app/admin/layout.tsx`) calls `requireStaff()` once; individual
admin pages call `requirePermission(...)` for their feature, e.g.
`app/admin/analytics/page.tsx` → `requirePermission(PERMISSIONS.ANALYTICS_READ)`.

---

## Edge middleware (`middleware.ts`)

The **coarse, first** line of defence. It runs on the Edge runtime using the
Node-free `authConfig`, so it only knows the role-derived session — it does
**not** call the backend. Its job: bounce obvious cases early and tag private
pages `noindex`.

```
request /admin/* or /account/*
        │
   not signed in? ──────────► redirect /login?callbackUrl=<path>
        │ signed in
   /admin/* and !isStaff? ──► redirect /forbidden
        │
   add header X-Robots-Tag: noindex, nofollow → continue
```

Note the middleware only checks `isStaff` for `/admin`; it does **not** do
per-permission gating. That granularity lives in the server guards.

---

## Nav gating (`lib/rbac/nav.ts`)

Navigation is declared once and filtered by permission at render time. Each
admin `NavItem` may carry a required `permission`; `filterNav` drops anything the
session can't access and removes now-empty groups:

```ts
export function filterNav(groups, session) {
  return groups
    .map((g) => ({ ...g, items: g.items.filter(
      (item) => !item.permission || can(session, item.permission)) }))
    .filter((g) => g.items.length > 0)
}
```

`components/dashboard/dashboard-nav.tsx` is the render site. It receives the
session `permissions` as props (the server-only `Permission` type doesn't cross
the client boundary as a value) and calls
`filterNav(variant === "admin" ? ADMIN_NAV : ACCOUNT_NAV, { permissions })`.

`ACCOUNT_NAV` items are **permission-free** — every authenticated customer sees
the full account menu.

### ADMIN_NAV → permission mapping

| Group     | Item              | href                  | Required permission   |
|-----------|-------------------|-----------------------|-----------------------|
| —         | داشبورد           | `/admin`              | *(none, always shown)* |
| فروشگاه   | محصولات           | `/admin/products`     | `products:read` |
| فروشگاه   | دسته‌بندی‌ها       | `/admin/categories`   | `products:read` |
| فروشگاه   | برندها            | `/admin/brands`       | `products:read` |
| فروشگاه   | موجودی            | `/admin/inventory`    | `inventory:read` |
| فروشگاه   | سفارش‌ها          | `/admin/orders`       | `orders:read` |
| فروشگاه   | مشتریان           | `/admin/customers`    | `customers:read` |
| محتوا     | دیدگاه‌ها          | `/admin/reviews`      | `reviews:read` |
| محتوا     | دستورها           | `/admin/recipes`      | `recipes:read` |
| محتوا     | بنر هیرو          | `/admin/hero-slides`  | `hero:manage` |
| سیستم     | تحلیل‌ها           | `/admin/analytics`    | `analytics:read` |
| سیستم     | نقش‌ها و دسترسی‌ها  | `/admin/roles`        | `roles:manage` |
| سیستم     | تنظیمات           | `/admin/settings`     | `settings:manage` |

> **Routing note (Next.js 16):** the `(account)`/`(storefront)`/`(auth)` route
> groups add **no** URL segment, but `app/admin/*` is a real path segment, so
> these hrefs are the canonical paths. Params/searchParams in these pages are
> async — `await` them.

---

## How this maps onto the backend (the real gate)

The frontend can be bypassed entirely (it's just JS + a derived permission
list). Actual authorization happens in the API.

### Backend middleware (`apps/backend/internal/middlewares/auth.go`)

- **`Auth(jwt)`** — validates the bearer access token; injects `uid` (int64),
  `userID` (uuid), and `role` (string) into the request context. Missing/invalid
  token → `401`.
- **`RequireRole(roles…)`** — must run **after** `Auth`; rejects any caller whose
  role isn't in the allow-list with `403 INSUFFICIENT_PERMISSIONS`.

```go
func RequireRole(roles ...string) gin.HandlerFunc {
    allowed := /* set of roles */
    return func(c *gin.Context) {
        role, _ := c.Get(ctxKeyRole)
        if _, ok := allowed[role.(string)]; !ok {
            abort(c, response.ErrInsufficientPermissions) // 403
            return
        }
        c.Next()
    }
}
```

### What the backend actually enforces today

The entire `/admin` API group is guarded **at the group level** by a single
role check (`apps/backend/internal/routes/routes.go`):

```go
a := v1.Group("/admin")
a.Use(mw.Auth(jwt), mw.RequireRole("admin"))   // ← the only RequireRole call
```

```
┌──────────── frontend (UX) ─────────────┐   ┌──── backend (enforcement) ───┐
│ JWT.role → permissionsForRole(role)    │   │ JWT.role                     │
│   ↓ session.permissions                │   │   ↓                          │
│ can()/filterNav()  hide/show UI        │   │ RequireRole("admin")         │
│ requirePermission() redirect /forbidden│   │   → 403 if role != admin     │
└────────────────────────────────────────┘   └──────────────────────────────┘
        fine-grained, per-permission              coarse, admin-only (today)
```

> ⚠️ **Mismatch — read this.** The frontend models a rich,
> per-permission scheme with `support` and `manager` roles, but the backend
> `/admin` routes today accept **only `role == "admin"`**. `RequireRole` is
> called exactly once, with `"admin"`. There is **no per-permission enforcement
> server-side** and **no route that admits `support`/`manager`/`vendor`** yet.
>
> Consequences:
> - A `support` or `manager` user passes `isStaff()` and the edge middleware,
>   sees a (filtered) admin sidebar, and reaches admin pages — but **every
>   write/read against the `/admin` API will be rejected `403`** because they
>   aren't `admin`.
> - The `roles`/`permissions`/`user_roles`/`role_permissions` tables exist in
>   migrations (`20260525210306`–`…0309`) but are **not yet wired into route
>   enforcement**. The permission catalogue is, for now, a frontend-only
>   contract waiting for the backend to honour it.
>
> Treat non-admin staff roles as **aspirational** until the backend swaps
> `RequireRole("admin")` for per-permission middleware (or `RequireRole` gains
> the other staff roles). The accurate statement today is: **staff = admin.**

### Permissions in nav but not in the backend at all

`hero:manage` (`HERO_MANAGE`) gates the `/admin/hero-slides` nav item and is in
the catalogue, but it has **no dedicated backend role/permission check** — it
rides on the same blanket `RequireRole("admin")` as the rest of `/admin`. The
same is true of `roles:manage`, `settings:manage`, `recipes:*`, etc.: they
differentiate the **frontend UI** per role, but the backend currently makes no
distinction beyond "is the caller `admin`?".

### Role provisioning

`POST /auth/register` always forces `role=customer`. Staff roles must be set
out-of-band (seed/migration) or promoted by an existing admin via
`PATCH /admin/users/:userID`. The refresh endpoint re-reads the user's current
role, so **role changes take effect on the next token refresh**, not instantly.

---

## Extending the system

To add a new admin capability, the frontend side is three edits:

1. Add the `RESOURCE_ACTION: "resource:action"` row to `PERMISSIONS` (+ a Persian
   label in `PERMISSION_LABELS`).
2. Grant it to the appropriate roles in `ROLE_PERMISSIONS` (`admin` gets it for
   free via `ALL`).
3. Tag the nav entry in `ADMIN_NAV` with `permission: PERMISSIONS.…` and guard
   the page with `await requirePermission(PERMISSIONS.…)`.

**But that only changes UX.** For it to be a real boundary, the backend must add
a matching `RequireRole(...)` (or future per-permission middleware) on the
corresponding route group in `internal/routes/routes.go`. Until then the
permission is decorative.
