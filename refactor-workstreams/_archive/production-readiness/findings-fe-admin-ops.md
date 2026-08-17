# Findings — fe-admin-ops

**Workstream:** `production-readiness-20260816`  
**Agent:** `fe-admin-ops`  
**Date:** 2026-08-16  
**Mode:** Investigation only. No application code changed.

Lane: whole admin console **except** product create/edit form (PR-001/002/011) and loyalty operator UI already specified as PR-003b/k.

IDs: **PR-060+** (PR-020 = catalog-content / money-ops, PR-030 = commerce-account, PR-040 = identity + platform-quality).

---

## Epic 2 re-verify (IMPROVEMENT 2026-06-20 vs current code)

| Audit row | Verdict | Evidence |
| --- | --- | --- |
| **2.1** Orders / inventory / reviews / analytics render `lib/admin/data.ts` mocks (`adminOrders`, `revenueSeries`, `topProducts`) | **Resolved.** File and symbols are gone. | `apps/frontend/lib/admin/` only has `category-keys.ts`. Grep for `adminOrders` / `revenueSeries` / `lib/admin/data` = **0** hits. Pages call live APIs: `useAdminOrders` → `/api/admin/admin/orders`; inventory `listInventory()` → `GET /admin/inventory`; reviews `useAdminReviews` → `/api/admin/admin/reviews`; analytics `features/analytics/api.ts` → `/admin/analytics/*`. Dashboard cards use `fetchRevenueToday` / `listAdminOrders` / `fetchLowStockInventory`. |
| **2.2** Fake `"(نمونه)"` success toasts on refund/status/block/set-stock/delete | **Resolved.** | Grep `نمونه` under admin: only honest UI copy (shipping cost preview, gift amount placeholder, recs “نمونهٔ trending”). `OrderActions` toasts after `updateAdminOrderStatusClient`. `UserAccountActions` after `updateAdminUser` / `deactivateAdminUser`. Inventory popover after `adjustVariantStockAction`. Product delete after a real action. |

Do **not** re-open Epic 2 as “admin is half-mock.” Remaining issues are RBAC holes, thin operator contracts, and missing surfaces — not fabricated datasets.

---

## What I inspected

All `apps/frontend/app/admin/**` pages except product editor internals. Feature owners under `features/admin/*`, domain APIs (`orders`, `inventory`, `reviews`, `analytics`, `payments`, `gift-cards`, `customers`, `shipping`, `coupons`, `settings`, `journal`, `recipes`, `hero-slides`, `recommendations`), BFF `app/api/admin/[...path]/route.ts`, FE RBAC (`lib/rbac/*`), and BE route composition + order/review/inventory/user/gift DTOs for contract checks.

Also re-read wave-2 BE reports after they landed: `findings-be-money-ops.md` (PR-020d/i/l), `findings-be-identity-security.md` (PR-040e ban), `findings-be-catalog-content.md` (settings lock PR-021).

---

## Highest-confidence live bugs

### 1. Default staff is locked out of tags / coupons / shipping

Nav + seed staff matrix grant `tags:manage`, `coupons:manage`, `shipping:manage` (`lib/rbac/roles.ts` `STAFF_DEFAULTS`, `lib/rbac/nav.ts`). BE mounts those writes on the same capabilities (`internal/routes/routes.go` 221–230).

Page guards are **role === admin**, not the capability:

- `features/admin/tags/admin-only.ts` `requireTagAdmin`
- `features/admin/coupons/admin-only.ts` `requireCouponAdmin`
- `features/admin/shipping/admin-only.ts` `requireShippingAdmin`

A default staff user sees the sidebar links, then `/forbidden`. Operators cannot run the three commerce modules they are seeded for.

### 2. Dashboard pretends every staffer is a super-admin

`app/admin/page.tsx` has **no** `requirePermission` (layout is only `requireStaff`). Module cards are rendered with `permissionsForRole("admin")` — the full catalogue — not `session.permissions`.

`AdminModuleOverview` therefore always attempts customer/coupon/shipping/payment/tag counts and always **links** those modules. Staff without the cap get failed counts (“دریافت شمارش ناموفق بود”) plus clickable paths that 403. Revenue widgets fire `/admin/analytics/*` (needs `analytics:read`); failure is a generic error, not a hide.

Sidebar nav is correctly filtered from the live session. Dashboard is not.

### 3. Payments + gift-cards pages ignore their capabilities

Nav requires `payments:read` / `gift-cards:issue`. Pages only `requireStaff`:

- `app/admin/payments/page.tsx`
- `app/admin/payments/[id]/page.tsx`
- `app/admin/gift-cards/page.tsx`

Any panel role who types the URL gets the UI. BE still enforces the cap on API calls. Payments board also links “صدور کارت هدیه” with no gift-card check.

### 4. Customer write controls are shown to readers

List always shows “ساخت کاربر” (`customers-view.tsx`); create **page** is `CUSTOMERS_WRITE` so readers hit forbidden. Detail always shows “ویرایش کاربر” and `UserAccountActions` (deactivate / reactivate) with no `canWrite` / `customers:ban`. Wallet credit **is** gated (`canCreditWallet`).

Ban/unban is live on detail (`UserAccountActions`, PR-064b) behind `customers:ban` — not `customers:write`. PATCH still cannot toggle `is_banned`.

### 5. Admin order cannot be fulfilled from the UI or the DTO

BE `OrderResponse` / `OrderListItem` omit `user_id`, email, address, shipping method, coupon. FE types match. `order-detail-view.tsx` is lines + totals + `window.print()`.

`PATCH /admin/orders/:id/status` is status-only. Refund statuses sit in the same `orders:write` dropdown. Green toast, no money. **be-money-ops already proposed PR-020d (real refund), PR-020i (identity + ship-to on GET), PR-020l (allowed transitions).** This lane only proposes the **FE consume** of those contracts.

List: `useAdminOrders({ page, limit: 50 })` never sends `status` / `user_id`. `DataTable` filters/search run on the current page only. BE already accepts those query fields.

### 6. Inventory list is a full-table download

**Resolved (PR-063a / PR-063b).** List uses one `listInventory()` page (`page`/`limit=20`/`search`/`low_stock`). `listAllInventory()` is no longer called from `/admin/inventory`. A failed list GET is `AdminDataErrorState` + retry, not empty warehouse copy. Auth `401`/`403` still throw to `app/admin/error.tsx`.

Dashboard `LowStockList` now prints live `product_title` (SKU / `#id` fallback). **PR-063c done.**

### 7. Content editors: read can write (same class as PR-011b, not the product form)

- Category edit: `PRODUCTS_READ`, `CategoryForm` has no `canWrite`.
- Recipe edit: `RECIPES_READ`, `RecipeForm` has no `canWrite`. Tag lookup `limit: 200` + swallow — **PR-001c**.
- Journal `[id]` requires `JOURNAL_WRITE` (readers cannot open a post).
- Options list requires `PRODUCTS_WRITE`.

### 8. Settings + loyalty RSC have no local error

`getAdminSiteSettings()` uncaught. Loyalty fetch uncaught — **PR-003k**. Settings last-write-wins is **be-catalog-content PR-021** (`expected_updated_at`); FE will send the field when it exists.

### 9. Dead command search

`dashboard-shell.tsx` “جستجو در پنل… ⌘K” has no handler.

---

## Wired and generally healthy

Orders/inventory/reviews/analytics/customers/roles/journal/recipes/hero/brands/categories/tags/options/coupons/shipping/payments/gift-issue/recs/monitoring are **live APIs**, not mocks. Empty/error exist on most CRUD boards. Gift settings tab is live (not mock). Admin BFF first-segment `admin` covers `/api/admin/admin/…`. Idempotency-Key still **PR-003c**.

`fe-platform-quality` PR-046 already owns eager `recharts` in `Charts.tsx` — not re-proposed.

---

## Cross-lane answers

| From | Answer |
| --- | --- |
| `be-catalog-content` settings `expected_updated_at` | Yes, FE will send it. Gift group is live. |
| `be-catalog-content` recipe slug 409 | FE already toasts API errors. |
| `be-catalog-content` unbounded option-types | Options board uses catalog hook; product N+1 stays PR-011c. |
| `be-money-ops` PR-020d/i/l | Confirmed FE problem. This lane only consumes those APIs (PR-062). |
| `be-identity-security` PR-040e ban | Landed. PR-064b is the FE confirm UI behind `customers:ban`. |
| `fe-platform-quality` PR-003c on wallet credit | Ack. Gift issue + adjust also need the header. |
| `fe-commerce-account` pending checkout | Admin status-only is the same lie on the operator side. |

---

## Loyalty leftover (beyond PR-003b/k)

`/admin/loyalty` is still a read-only env poster. No new loyalty IDs.

---

## Proposed tasks (PR-060+)

Do **not** re-propose PR-001*, PR-002a, PR-003*, PR-011*, money-ops **PR-020d/i/l**, identity **PR-040e**, catalog-content **PR-021**, platform **PR-046**.

### Task Group PR-060 — Admin shell / dashboard

- [ ] **PR-060a — Dashboard module cards use session permissions** · **fe** · **P1** · **S**  
  Stop `permissionsForRole("admin")` on `AdminModuleOverview`.

- [ ] **PR-060b — Gate dashboard analytics widgets** · **fe** · **P1** · **S**  
  Hide blocks without `analytics:read` / `orders:read` / `inventory:read`.

- [x] **PR-060c — Dead ⌘K search** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  Wire a command palette or remove the fake control.

### Task Group PR-061 — RBAC page gates match capabilities

- [ ] **PR-061a — Tags / coupons / shipping: `requirePermission`, not `role === "admin"`** · **fe** · **P0** · **S**  
  Replace `requireTagAdmin` / `requireCouponAdmin` / `requireShippingAdmin`.

- [ ] **PR-061b — Payments + gift-cards page gates** · **fe** · **P1** · **S**  
  `PAYMENTS_READ` / `GIFT_CARDS_ISSUE`. Hide unusable cross-links.

- [ ] **PR-061c — Customer write affordances** · **fe** · **P1** · **S**  
  Hide create / edit / deactivate unless `customers:write`. Ban stays off until identity PR-040e.

- [x] **PR-061d — Category + recipe editors honor write** · **fe** · **P1** · **S**  
  Same pattern as PR-011b.

- [x] **PR-061e — Journal detail readable; options list readable** · **fe** · **P2** · **S** · **DONE 2026-08-16**

### Task Group PR-062 — Orders operator FE (after money-ops)

- [ ] **PR-062a — Render identity + ship-to when PR-020i lands** · **fe** · **P0** · **M**  
  Do not invent fields. Link `/admin/customers/:uuid`.

- [x] **PR-062b — Fulfillment vs refund UI when PR-020d/l land** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  Until then: do not offer refund statuses as a silent PATCH, or label them status-only.

- [x] **PR-062c — Server-side order filters** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  Pass `status` / dates to `GET /admin/orders`.

- [x] **PR-062d — Render gift / notes / schedule already on the DTO** · **fe** · **P2** · **S** · **DONE 2026-08-16**

### Task Group PR-063 — Inventory + reviews leftover

- [x] **PR-063a — Inventory server pagination + `search` / `low_stock`** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  Stop `listAllInventory()`.

- [x] **PR-063b — Inventory list error state** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-063c — Dashboard low-stock titles** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [ ] **PR-063d — Review queue product label** · **both** · **P2** · **S**  
  Prefer BE `product_title` + slug on admin review.

### Task Group PR-064 — Customers / gifts leftover

- [x] **PR-064a — Gift-card operator list (after BE)** · **both** · **P2** · **M** · **DONE 2026-08-16**  
  Paginated `GET /admin/gift-cards` + confirm void. No fake ledger.

- [x] **PR-064b — Ban UI after identity PR-040e** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  Confirm `POST /admin/users/:id/ban|unban` behind `customers:ban`.

- [x] **PR-064c — Customer list: orders count + jump** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  After PR-020i / PR-062a. Count from `total_orders`. Jump only when
  `user_id` is a positive internal id — UUID is not an orders filter.

- [x] **PR-064d — Payment user id vs UUID** · **both** · **P2** · **S** · **DONE 2026-08-16**  
  Admin payment `user_id` is public UUID; list/detail jump to `/admin/customers/:uuid`.

### Task Group PR-065 — Settings / recs polish

- [ ] **PR-065a — Settings RSC error + send `expected_updated_at`** · **fe** · **P1** · **S**  
  Error state now; optimistic lock when catalog-content PR-021 exists.

- [x] **PR-065b — Recs trending error ≠ empty** · **fe** · **P2** · **S** · **DONE 2026-08-16**

---

## Explicit non-goals from this lane

- Product form lookups / post-save nav / product list pagination (PR-001/002/011).
- Loyalty member/adjust/programme PUT (PR-003*).
- Re-implementing mock `lib/admin/data.ts` (deleted).
- New refund / ban / gift-list / settings-lock APIs (owned by other wave-2 BE tasks).
- Admin subscriptions / referrals / alerts (no FE routes).
- Dynamic recharts (platform PR-046).

---

No application code changed.
