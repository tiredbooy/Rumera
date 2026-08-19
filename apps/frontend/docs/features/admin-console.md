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
| ⌘K command search | `admin-command-menu.tsx` — desktop trigger + `⌘K` / `Ctrl+K` |
| Page header / stats | `page-header`, `stat-card`, module overview |
| Nav model | `lib/rbac/nav.ts` — filtered by `can()` |
| Forbidden | `app/forbidden` |

Nav entries declare required permissions. Hidden UI is **not** security —
backend `RequireRole` / permission checks are.

The shell ⌘K palette is live. It filters the same permission-gated nav
model, then (after two characters) queries existing list search:

- products: `GET /admin/products?search=` when `products:read`
- customers: `GET /admin/users?search=` when `customers:read`

There is **no** admin order list `search` param. A bare positive integer
offers “سفارش #N” → `/admin/orders/:id` when `orders:read`. A failed
live search still offers the matching board URL (`/admin/products?q=`,
`/admin/customers?q=`). The account shell variant does not render this
control.

Dashboard `/admin` work-queue tiles take live `session.permissions` from
`requireStaff()` — not `permissionsForRole("admin")`. A staffer without
`orders:read` does not see order tiles; the same filter applies to
payments, reviews, and inventory. Revenue reporting lives at `/admin/analytics`.

---

## Module map (high level)

| Path | Feature folder | Capability (typical) |
|------|----------------|----------------------|
| `/admin` | analytics widgets + overview | analytics read; low-stock widget needs inventory read |
| `/admin/products` | `admin/products` | product write |
| `/admin/categories` | `admin/categories` | catalog |
| `/admin/brands` | `admin/brands` | catalog |
| `/admin/tags` | `admin/tags` | catalog |
| `/admin/inventory` | `admin/inventory` + `inventory` | inventory |
| `/admin/orders` | `admin/orders` | orders |
| `/admin/payments` | `admin/payments` | payments:read |
| `/admin/shipping` | `admin/shipping` | shipping |
| `/admin/coupons` | `admin/coupons` | promotions |
| `/admin/gift-cards` | `admin/gift-cards` + `gift-cards` | gift-cards:issue |
| `/admin/customers` | `admin/customers` / `customers` | customers |
| `/admin/loyalty` | `admin/loyalty` | customers:read (programme + member search) |
| `/admin/loyalty/[userID]` | `admin/loyalty` | customers:read; adjust needs customers:write |
| `/admin/hero-slides` | `admin/hero-slides` | content |
| `/admin/recipes` | `admin/recipes` | content |
| `/admin/journal` or blogs | `admin/journal` / blogs | content |
| `/admin/reviews` | `admin/reviews` | moderation; product title (slug / `#id` fallback) |
| `/admin/roles` | `admin/roles` | RBAC |
| `/admin/settings` | `admin/settings` | site settings |
| `/admin/recommendations` | `recommendations` | analytics:read |
| `/admin/monitoring` | `admin/monitoring` | analytics:read + Prometheus |

Exact permission strings live in `lib/rbac/permissions.ts` — treat that file as
the UI source of truth and keep it aligned with backend roles.

### Orders list (`/admin/orders`)

The board is **server-filtered**. The route reads `status`, `paid_from`,
`paid_to` (calendar days), `user_id`, and `page`, then
`useAdminOrders` calls `GET /admin/orders` with those params
(`paid_*` expanded to RFC3339 local day bounds). DataTable no longer
facets the current page of 50. A filtered miss is «سفارشی با این فیلترها
یافت نشد»; an unfiltered empty list is «هنوز سفارشی ثبت نشده است». Date
filters are **paid_at**, not created_at.

### Orders (`/admin/orders/:id`)

Admin order detail renders the PR-020i GET projection: buyer identity (safe
fields only), ship-to snapshot (`ship_to`, falling back to `address`),
shipping method, coupon code, and payment summary. Gift / notes / schedule
already on that DTO (`is_gift`, `gift_message`, `gift_addons`, `notes`,
`scheduled_delivery_date`) print in a «هدیه و یادداشت» card when any of
them is present — the extras card is omitted otherwise, not filled with
«ثبت نشده». The customer link is `/admin/customers/:uuid` only when
`user.user_id` is present — a numeric `user_id` is shown, not invented as
a customer path. Missing identity / ship-to fields print «ثبت نشده»; a
wallet (or otherwise unattached) order says «تراکنش پرداختی ثبت نشده
است». Fulfill from the snapshot, not the live address book.

`OrderActions` (PR-062b) splits warehouse fulfillment from refund:

- **Status select** offers only the PR-020l hops (`paid → processing →
  ready_to_ship|shipped → out_for_delivery|delivered`). Current status is
  shown disabled for the trigger; `paid` / `cancelled` / refund-family are
  never selectable targets — those are command-only and a PATCH would
  `409`.
- **Refund** is a separate confirm button that `POST`s
  `/admin/orders/:id/refund` (wallet credit when wallet, restock, loyalty
  clawback, then `refunded`). Toasts follow the real response; do not
  PATCH `status=refunded`. Non-wallet money return stays operator/manual.

### Admin home (`/admin`) widgets

`LowStockList` loads `GET /admin/inventory/low-stock` (`fetchLowStockInventory`)
and needs `inventory:read`. Row labels use the live `product_title` when the
API sent one. Empty title falls back to `sku`, then `#` + variant id — the
widget does not invent a product name and does not print `متغیر #{id}` when
a title exists. The endpoint is paginated (`{results, pagination}`); the
widget unwraps `results` and still accepts a raw array.

### Payments and gift-cards page gates

`requirePaymentAdmin` / `requireGiftCardAdmin` are thin wrappers around
`requirePermission` with `payments:read` / `gift-cards:issue`. They do **not**
check `role === "admin"`. Staff without the grant (or any non-panel role) lands
on `/forbidden`. Seed staff defaults include `payments:read` but **not**
`gift-cards:issue`; a default operator can open `/admin/payments` and
`/admin/payments/:id`, and is denied `/admin/gift-cards` unless the live
matrix grants issue. Admin superuser still passes because `can()` / live
permissions give admin the full catalogue. Backend admin routes use the same
IDs.

Payment list and detail (PR-064d) show response `user_id` as the public
UUID (`users.user_id`) and link it to `/admin/customers/:uuid`. An
internal integer is not turned into a customer path. The list filter
`user_id` is still the numeric `users.id`.

### Gift-card operator list (PR-064a)

`/admin/gift-cards` keeps the issue form and adds a real ledger under
«دفتر کارت‌ها». The list is URL-driven (`page`, `status`, `q`, `sort`) and
calls `GET /admin/gift-cards` (`{results, pagination}`, `limit=20`). Failures
are retryable alerts — not an empty “no cards” state. Void is a confirm
`POST /admin/gift-cards/:id/void` on **active** rows only. Copy states that
void is not a refund; `409 INVALID_STATE` / `404` messages come from the API.
Numeric `purchaser_user_id` is shown, not turned into a customer UUID path.

### Customers (`/admin/customers`)

`GET /admin/users` already returns `total_orders` on each row. The list
prints that count (mobile card + desktop column). A jump to
`/admin/orders?user_id=` is emitted **only** when `user_id` is a positive
integer — the same internal id `GET /admin/orders` accepts. Live list
`user_id` is the public UUID; that value is **not** turned into an orders
filter (the board would drop it and show every order).

### Customers (`/admin/customers/:id`)

Detail requires `customers:read`. Create / edit / deactivate stay behind
`customers:write`. Wallet credit stays `wallet:credit`. **Ban / unban**
(PR-064b) is a separate confirm action on `UserAccountActions` that
`POST`s `/admin/users/:id/ban` and `/unban`. It is shown only with
`customers:ban` — not `customers:write`. Self-ban/unban is hidden.
`PATCH` cannot toggle `is_banned`. Unban does not reactivate an inactive
account.

### Reviews (`/admin/reviews`)

The moderation queue labels each row with `product_title` from
`GET /admin/reviews`. Missing title falls back to `product_slug`, then
`محصول #{id}`. Operators should not have to memorize a product id.

### Recommendations (`/admin/recommendations`)

Operator recs health: live interaction aggregates plus a public trending
sample. The admin helper `getTrending` in
`features/recommendations/admin-api.ts` calls `GET /recommendations/trending`
and **throws**. Storefront `features/recommendations/api.ts` stays
error-safe for rails (empty fallback). A failed trending fetch is
`AdminDataErrorState` («بارگذاری Trending ناموفق بود») with the shared
`router.refresh` retry — not «trending خالی است». A successful empty
list is cold-catalog copy only; it does not mention an unavailable API.
Auth `401`/`403` still throw to `app/admin/error.tsx`.

---

## Data access patterns

1. **Server Components** on admin pages often call domain server helpers with
   `apiFetch` (session on server) for initial data. Brand / category / tag
   selects go through `features/admin/shared/fetch-lookup-list.ts` with
   `limit≤100`. Lookup failures must throw (admin `error.tsx`), not render an
   empty picker. The product editor option catalog
   (`getProductOptionCatalog` N+1) is isolated: a catalog throw must not empty
   those lookups or 500 the form. The variants section still shows the empty
   options chrome plus a distinct Persian error and `router.refresh()` retry.
2. **Client boards** (tables, forms) use React Query + domain admin clients that
   hit `/api/admin/*`.
3. After successful **mutations**, call revalidation plans so the public
   storefront updates ([media-and-cache.md](./media-and-cache.md)).
4. **Uploads** go through `features/image-uploader` → admin upload endpoints →
   backend media ownership rules.

### Product list (`/admin/products`)

The catalogue board is **server-paginated**. The route reads `q` (alias
`search`), `page`, optional `is_active`, and `sort` / `sortBy`+`orderBy`, then
calls `fetchAdminProducts` (`GET /admin/products`) with `limit≤100`. The pager
uses `pagination.total_items`, `total_pages`, and `page`. Client-side table
search is **not** the full catalogue — extra rows are no longer dropped after
the first page. `is_active` is sent to the API; missing-weight warnings apply
to the **current page** only (there is no weight query param). Create stays
behind `PRODUCTS_WRITE`.

A failed `fetchAdminProducts` is **not** an empty list: it renders
`AdminDataErrorState` («دریافت محصولات ناموفق بود») with the shared
`router.refresh` retry. Auth `401`/`403` still throw to `app/admin/error.tsx`.
Zero results split empty catalogue («هنوز محصولی ثبت نشده است») from a
filtered miss («محصولی با این فیلترها یافت نشد»).

### Category and recipe editors

`/admin/categories/[id]` is `products:read` so staff who can list the
tree can still open a category. Save and image upload need
`products:write` (`canWrite` on `CategoryForm`). `/admin/recipes/[id]`
is `recipes:read`; save, cover/OG upload, and delete need
`recipes:write` (`canWrite` on `RecipeForm`). `/admin/journal/[id]`
is `journal:read`; save and cover upload need `journal:write`
(`canWrite` on `JournalForm`). `/admin/options` is `products:read`;
create / edit / delete need `products:write` (`canWrite` on
`OptionsBoard` / `OptionTypeForm`). Create routes stay
write-gated. Readers see a Persian “فقط مشاهده” hint — they are not
403’d. List create / delete stay hidden without write. Backend write
routes remain the real gate.

### Editorial body editor

`components/admin/rich-text-editor.tsx` is shared by the recipe method and the
journal body. Besides text formatting it inserts the three block kinds the public
renderer already understands (CE-4):

| Control | Node | Serialises to |
|---------|------|---------------|
| تصویر | `EditorImage` (`components/admin/editor-nodes.ts`) | `<img src alt title>` |
| جدول | `EditorTable` — one atom holding a grid of plain-text cells, edited in `TableDialog` | `<table><thead><th>…</table>` |
| اشاره به محصول | — | `<a href="/products/:slug">` |

The serialisation is dictated by `lib/content/sanitize-html.ts`: it keeps `href`
and `title` on `<a>`, `src`/`alt`/`title`/`width`/`height` on `<img>`, and drops
every class and data attribute. A richer mention format would simply not render
on the public page.

The image control opens `MediaPickerDialog` — the media library (CE-10). It
lists `GET /admin/uploads` (stored originals, newest first), uploads a new file
standalone, or takes an external HTTPS address. Standalone uploads stay alive
because `mediaReferencesCTE` scans `recipes.content` / `blogs.content` for
`/media/` keys.

### Site settings (`/admin/settings`)

`AdminSettingsView` loads `getAdminSiteSettings()`. A failed fetch is
`AdminDataErrorState` («بارگذاری تنظیمات ناموفق بود») with the shared
`router.refresh` retry — not a blank form that could overwrite live
groups. Auth `401`/`403` still throw to `app/admin/error.tsx`.

Save PUTs every group plus `expected_updated_at` copied from the last GET
`updatedAt`. After a successful save the form rebases onto the response
timestamp so a second save does not collide with itself.

---

## Forms and validation

Domain Zod (or equivalent) schemas live next to the feature
(`validations.ts` / `validations.test.ts`). Server still re-validates; client
schemas exist for fast UX only.

---

## Analytics charts

Admin home and `/admin/analytics` cards keep **ChartCard** chrome and existing
empty/error states. Series paint is TanStack Charts (`@tanstack/charts` 0.14,
`defineChart` + `@tanstack/charts/react`). Shared host/theme/ticks live in
[`@/lib/charts`](../../lib/charts/) — see [Admin charts](#admin-charts).

| Series | Component | Mark | Color |
|--------|-----------|------|-------|
| Daily orders | `OrdersBarChart` | `barY` | `oklch(0.62 0.16 250)` |
| Daily revenue | `RevenueAreaChart` | `areaY` + `lineY` | gold `oklch(0.72 0.15 75)` |
| Top products | `HorizontalBars` via `AnalyticsTopProducts` | `barX` | wine `oklch(0.55 0.18 25)` |
| Event mix | `HorizontalBars` via `AnalyticsEventBreakdown` | `barX` | blue `oklch(0.62 0.16 250)` |
| Order status | `DonutChart` + `DonutLegend` | `pie` + `radialArc` + center `radialText` | `SLICE_COLORS` (gold → cool) |

`AnalyticsRevenueCharts` maps `{ day, revenue, orders }` from the revenue
time-series API and imports `RevenueAreaChart` / `OrdersBarChart` from their
own files (not `Charts.tsx`). Dashboard `/admin` (`RevenueChartSection`) uses
the same `RevenueAreaChart`. Day labels stay Jalali-short
(`shortAnalyticsDay`). Revenue tooltips are `faToman`; Y ticks are
`faMoneyTick` (millions + «م»). Surfaces are `dir="rtl"` via `RumeraChart`.
Animation honors `prefers-reduced-motion`. Empty/error cards stay text —
never invent a series.

`OrderStatusSection` (admin home) maps today's completed / cancelled / refunded
counts onto `DonutChart`. Center `radialText` is the Persian total (`faNum`)
plus «سفارش». The legend is Persian labels + `faNum` values. Slice paint is
kernel `SLICE_COLORS` (lock-step with `Charts.tsx`). Tooltip is `وضعیت · عدد`.

Rankings (`AnalyticsTopProducts`, `AnalyticsEventBreakdown`) import
`HorizontalBars` (TanStack `barX`, largest-first, `faNum` ticks, Persian
tooltip). Product bars with an `href` navigate on select. `Charts.tsx` is `ChartCard` + `SLICE_COLORS` + a `HorizontalBars` re-export.
Recharts is removed. Charts import `RumeraChart` from `@/lib/charts`.

## Admin charts

New admin charts use **TanStack Charts** via the kernel at [`lib/charts/`](../../lib/charts/):

```ts
import {
  RumeraChart,
  rumeraChartTheme,
  rumeraSvgAnimation,
  faMoneyTick,
  faTick,
  faToman,
  CHART_GOLD,
  CHART_BLUE,
} from "@/lib/charts"
import { defineChart, areaY } from "@tanstack/charts"
```

- Theme: gold `oklch(0.72 0.15 75)`, blue `oklch(0.62 0.16 250)`, grid `var(--border)`. Spread `theme: rumeraChartTheme` on `defineChart`.
- `<RumeraChart definition={…} ariaLabel="…" />` is RTL (`dir="rtl"`) and sets `--ts-chart-*` palette vars.
- `Chart` has no motion prop. Pass `svgAnimation: rumeraSvgAnimation` (`respectReducedMotion: true`) or `usePrefersReducedMotion()` when building the definition. Optional springs: `motion()` from `@tanstack/charts/motion`.
- Keep existing empty/error cards. Do not import `recharts` for new charts.

---

## Monitoring board

`/admin/monitoring` queries Prometheus (`PROMETHEUS_URL`) for RPS, latency,
errors, cache ratio, circuit state. Documented in [api-monitoring.md](./api-monitoring.md).
Req/s, 5xx %, and p95 cards are TanStack Charts area/line (PR-100e).
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
