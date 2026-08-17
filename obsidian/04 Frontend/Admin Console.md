---
tags:
  - frontend
  - admin
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Admin Console

`/admin/*` — DashboardShell, [[RBAC]] nav, force-dynamic.

Desktop ⌘K (`AdminCommandMenu`) searches permitted nav + live
`GET /admin/products?search=` / `GET /admin/users?search=`. Orders have
no list search — a numeric query jumps to `/admin/orders/:id`. Failed
hits still open the product/customer board `q=`. Account variant hides
it. See [[Search FE]] · [[Customers Admin]] · [[Catalogue]].

Dashboard `/admin` module cards (`AdminModuleOverview`) filter on live
`session.permissions` from `requireStaff()`, not `permissionsForRole("admin")`.
Missing `customers:read` hides the users card; same for coupons / shipping /
tags / payments / gift-cards.

Analytics widgets on `/admin` hide and skip fetch without the matching
read: `RevenueCards` / `RevenueChartSection` / `OrderStatusSection` need
`analytics:read`; `RecentOrdersTable` needs `orders:read`; `LowStockList`
needs `inventory:read`. Low-stock rows show `product_title` from
`GET /admin/inventory/low-stock` (paginated `results`); missing title
falls back to SKU then variant id — no invented names (PR-063c).

Modules: products, inventory, orders, payments, shipping, coupons, customers, loyalty, content, analytics, monitoring, settings, roles, …

`/admin/orders` sends `status` / `paid_from` / `paid_to` / `user_id` /
`page` to `GET /admin/orders` (PR-062c). It does not client-filter one
page. Date inputs are paid_at calendar days (RFC3339 on the wire).

`/admin/orders/:id` shows buyer identity + ship-to snapshot + method / coupon /
payment summary from GET (PR-020i). Gift / notes / preferred delivery
(`is_gift`, `gift_message`, `gift_addons`, `notes`,
`scheduled_delivery_date`) render when present on that DTO (PR-062d) — no
invented empties. Customer link is `/admin/customers/:uuid` only when
`user.user_id` is present. Missing identity / ship-to fields are «ثبت نشده» —
not invented. Warehouse select is `paid → processing → …` only; refund is a
confirm `POST /admin/orders/:id/refund` (PR-062b) — never PATCH `refunded`.
See [[Orders]] · [[Journey Admin refund restock]] · [[Journey Buy as gift]].

`/admin/reviews` shows the product **title** (slug, then `#id` fallback)
from `GET /admin/reviews` — not a bare `product_id` (PR-063d). See
[[Wishlist and Reviews]] · [[Reviews Backend]].

`/admin/recommendations` trending sample uses a throwing admin
`getTrending` (`GET /recommendations/trending`). Failure is
`AdminDataErrorState` (retry), not cold-catalog empty copy (PR-065b).
Storefront rails still swallow to `[]`. `401`/`403` still throw. See
[[Recommendations]] · [[Recommendations Backend]].

Writes should revalidate storefront tags → [[Media and Cache FE]].

`/admin/settings` failed load is `AdminDataErrorState` (retry), not a blank
form. PUT sends `expected_updated_at` from the last GET `updatedAt` so a
stale tab cannot last-write-win gift prices. `401`/`403` still throw. See
[[Site Settings Backend]].

`/admin/products` is URL-driven (`q`/`search`, `page`, optional `is_active`,
sort) and pages `GET /admin/products` with `limit≤100`. Client table search
is not the catalogue. A failed fetch is `AdminDataErrorState` (retry), not
empty-catalogue copy. See [[Catalogue]] · [[Search Backend]].

Product / recipe editors load brand, category, and tag option lists on the
server (`fetch-lookup-list`, `limit≤100`). Failures surface via admin
`error.tsx` — they are not swallowed into an empty select. The product
editor option catalog is isolated from those lookups: a failed
`getProductOptionCatalog` keeps the form (and brand/category/tag pickers)
up and shows a distinct Persian error + retry in variants — not a silent
empty list and not a 500. See [[Journey Admin publish product]] ·
[[Catalogue]].

Category / recipe **edit** pages stay on read (`products:read` /
`recipes:read`) so staff can open the editor. Save, image upload, and
recipe delete honor `products:write` / `recipes:write` (`canWrite` on
`CategoryForm` / `RecipeForm`, same as the product editor). Journal
**detail** stays on `journal:read`; save / cover upload need
`journal:write` (`canWrite` on `JournalForm`). Options **list** (and
`/admin/options/[id]`) stay on `products:read`; create / edit / delete
need `products:write` (`canWrite` on `OptionsBoard` /
`OptionTypeForm`). Create stays write-gated at the page. Readers see
«فقط مشاهده» — not `/forbidden`.
See [[RBAC]] · [[Catalogue]] · [[Recipes and Journal]].

Product form **category picker labels** walk `parent_id` in memory
(`Parent / Child`; cycle-safe). A parent missing from the lookup page of
100 falls back to the title alone — same tree operators already see on
[[Surface Admin]] `/admin/categories`. Brand select stays flat. See
[[Frontend Domain Map]].

`/admin/loyalty` is programme snapshot + member search. Member account,
ledger, and adjust live at `/admin/loyalty/[userID]`. Programme / list /
ledger fetch use the same retry card as roles (`AdminDataErrorState`).
403 stays `requirePermission` → `/forbidden`. Adjust is hidden without
`customers:write`.

Tags, coupons, and shipping pages gate with `requirePermission`
(`tags:manage` / `coupons:manage` / `shipping:manage`), not
`role === "admin"`. Seed staff and [[RBAC]] nav already grant those
caps; a default staffer can open the boards.

Payments and gift-cards use the same wrapper pattern
(`requirePaymentAdmin` → `payments:read`, `requireGiftCardAdmin` →
`gift-cards:issue`). Seed staff has `payments:read` and can open
`/admin/payments`; it does **not** have `gift-cards:issue`, so
`/admin/gift-cards` is `/forbidden` until the live matrix grants issue.
Payment list/detail `user_id` is the public UUID and links to
`/admin/customers/:uuid` (PR-064d). An integer is shown as missing —
never `/admin/customers/7`.

`/admin/gift-cards` is issue **and** a paginated ledger (PR-064a). URL
`page` / `status` / `q` / `sort` map to `GET /admin/gift-cards`. Void is
confirm `POST /admin/gift-cards/:id/void` on active cards only — not a
refund. List errors retry; they are not an empty ledger. See
[[Loyalty Wallet Gift Cards]] · [[Gift Card Backend]].
See [[Playbook Add admin module]].

Customer list/detail require `customers:read`. Create, edit, and
deactivate / reactivate are hidden without `customers:write`. Wallet
credit is hidden without **`wallet:credit`** (PR-040c — not
`customers:write`, not `roles:manage`). Ban / unban on detail is
`customers:ban` (PR-064b) — confirm `POST` ban/unban, hidden without
the cap, self-ban hidden. `/admin/customers/new` and
`/admin/customers/[id]/edit` stay `requirePermission(customers:write)`.
List rows print `total_orders` from `GET /admin/users`. They link to
`/admin/orders?user_id=` only when that id is a positive integer
(PR-064c). The public UUID is not an orders filter.

Related: [[Inventory FE]] · [[Analytics]] · [[RBAC]] · [[Backend API]]

Bridge: `apps/frontend/docs/features/admin-console.md`

#frontend #admin
