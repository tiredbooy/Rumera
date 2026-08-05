# Admin console

**Who this is for:** engineers adding or changing staff UI under `/admin`.

**Related:** [RBAC](../platform/rbac.md) · [BFF & auth](../platform/bff-and-auth.md) ·
[API monitoring](./api-monitoring.md) · backend [API reference](../../../backend/docs/api/README.md)

---

## What the admin is

A **staff-only** Next.js surface for catalogue CMS, inventory, orders,
customers, content (hero/journal/recipes), promotions, settings, analytics, and
API performance monitoring. It is not a separate SPA — same app, different
route segment and layout.

```
Browser /admin/*
  → edge proxy coarse gate
  → app/admin/layout.tsx  (force-dynamic, DashboardShell, server staff guard)
  → page → features/admin/<module>/… or domain components
  → admin BFF /api/admin/* → Go /api/v1/admin|… with Bearer
```

---

## Shell and navigation

| Piece | Location |
|-------|----------|
| Layout shell | `features/dashboard/components/dashboard-shell.tsx` |
| Page header / stats | `page-header`, `stat-card`, module overview |
| Nav model | `lib/rbac/nav.ts` — filtered by `can()` |
| Forbidden | `app/forbidden` |

Nav entries declare required permissions. Hidden UI is **not** security —
backend `RequireRole` / permission checks are.

---

## Module map (high level)

| Path | Feature folder | Capability (typical) |
|------|----------------|----------------------|
| `/admin` | analytics widgets + overview | analytics read |
| `/admin/products` | `admin/products` | product write |
| `/admin/categories` | `admin/categories` | catalog |
| `/admin/brands` | `admin/brands` | catalog |
| `/admin/tags` | `admin/tags` | catalog |
| `/admin/inventory` | `admin/inventory` + `inventory` | inventory |
| `/admin/orders` | `admin/orders` | orders |
| `/admin/payments` | `admin/payments` | payments |
| `/admin/shipping` | `admin/shipping` | shipping |
| `/admin/coupons` | `admin/coupons` | promotions |
| `/admin/gift-cards` | `admin/gift-cards` | promotions |
| `/admin/customers` | `admin/customers` / `customers` | customers |
| `/admin/hero-slides` | `admin/hero-slides` | content |
| `/admin/recipes` | `admin/recipes` | content |
| `/admin/journal` or blogs | `admin/journal` / blogs | content |
| `/admin/reviews` | `admin/reviews` | moderation |
| `/admin/roles` | `admin/roles` | RBAC |
| `/admin/settings` | `admin/settings` | site settings |
| `/admin/monitoring` | `admin/monitoring` | analytics:read + Prometheus |

Exact permission strings live in `lib/rbac/permissions.ts` — treat that file as
the UI source of truth and keep it aligned with backend roles.

---

## Data access patterns

1. **Server Components** on admin pages often call domain server helpers with
   `apiFetch` (session on server) for initial data.
2. **Client boards** (tables, forms) use React Query + domain admin clients that
   hit `/api/admin/*`.
3. After successful **mutations**, call revalidation plans so the public
   storefront updates ([media-and-cache.md](./media-and-cache.md)).
4. **Uploads** go through `features/image-uploader` → admin upload endpoints →
   backend media ownership rules.

---

## Forms and validation

Domain Zod (or equivalent) schemas live next to the feature
(`validations.ts` / `validations.test.ts`). Server still re-validates; client
schemas exist for fast UX only.

---

## Monitoring board

`/admin/monitoring` queries Prometheus (`PROMETHEUS_URL`) for RPS, latency,
errors, cache ratio, circuit state. Documented in [api-monitoring.md](./api-monitoring.md).
When Prometheus is unset, the UI must stay **truthful** (offline/unconfigured
states — never fake charts).

---

## Adding a new admin module

1. Backend endpoints + permissions first (or confirm they exist).
2. `features/admin/<name>/` board + optional domain API module.
3. Thin `app/admin/<name>/page.tsx`.
4. Nav entry in `lib/rbac/nav.ts` with the correct permission.
5. Revalidation plan if writes affect public pages.
6. Unit tests for non-trivial validation or query helpers.
