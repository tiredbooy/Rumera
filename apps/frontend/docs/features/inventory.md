# Admin inventory (frontend)

**Who this is for:** engineers building or debugging `/admin/inventory`.

**Backend truth:** [inventory architecture](../../../backend/docs/architecture/inventory.md) ·
[API](../../../backend/docs/api/inventory.md)  
**Shell / permissions:** [admin-console](./admin-console.md) · [rbac](../platform/rbac.md)

---

## What this surface does

Staff monitor **per-variant** stock, open low-stock alerts, adjust quantities
with a typed movement, change reorder thresholds, and inspect the **movement
history** for a variant.

**Easy path for operators:** on the list, click the sliders icon → pick a
**تأمین سریع** chip (`+۵` / `+۱۰` / … / reorder suggestion) or type a signed
delta → **ذخیرهٔ موجودی**. Positive deltas are sent as `restock`; negative as
`adjustment`. The popover previews on-hand / available and blocks going below
reserved stock client-side.

**Rows always exist for variants:** creating a variant ensures a zero-stock
inventory row; get/adjust/reorder also ensure. A one-shot migration backfills
legacy variants. Empty list usually means no products yet → `make seed` or
create products in admin.

Customers never use these screens. Sellable stock on the storefront comes from
public product APIs (`available_*`), not from admin inventory clients.

### Weight on inventory rows (PH-020a)

`InventoryItem` includes:

| Field | Notes |
|-------|--------|
| `weight?` | kg from product catalogue |
| `missing_weight` | always boolean; true when weight unset or ≤ 0 |

List API is the source of truth — do not invent weight on the FE.

**PH-020b / 085a (shipped):** admin list shows a «وزن ناقص» badge + filter
«وزن بسته‌بندی», KPI card «وزن ناقص», and variant detail callout with link to
edit the product weight.

---

## Routes

| URL | File | Role |
|-----|------|------|
| `/admin/inventory` | `app/admin/inventory/page.tsx` | List + KPI cards + table |
| `/admin/inventory/[variantID]` | `app/admin/inventory/[variantID]/page.tsx` | Variant detail, adjust, reorder, movements |

Both are under the admin layout (`force-dynamic`, staff guard).

---

## Permissions

| Action | Permission constant |
|--------|---------------------|
| View list/detail/movements | `PERMISSIONS.INVENTORY_READ` |
| Adjust stock / patch reorder | `PERMISSIONS.INVENTORY_WRITE` |

Page uses `requirePermission(INVENTORY_READ)` and `can(session, INVENTORY_WRITE)`
to hide write controls. **Backend still enforces** the same permissions — UI
hiding is not security.

---

## Code map

| Concern | Location |
|---------|----------|
| Types (wire) | `features/inventory/types.ts` |
| Admin API client | `features/inventory/api.ts` |
| React Query hooks | `features/inventory/hooks.ts` |
| Query keys | `features/inventory/query-keys.ts` |
| Server actions / mutations helpers | `features/inventory/actions.ts` |
| Display helpers | `features/inventory/utils.ts` |
| List URL parse / href | `features/admin/inventory/inventory-list-params.ts` |
| List board | `features/admin/inventory/components/inventory-list-view.tsx` |
| Table UI | `features/admin/inventory/components/InventoryTable.tsx` |
| Variant detail UI | `features/admin/inventory/components/…` |
| Zod / form validations | `features/admin/inventory/validations.ts` |

Pattern: **domain API** under `features/inventory`, **admin board chrome** under
`features/admin/inventory`, **thin routes** under `app/admin/inventory`.

---

## List page behavior

`AdminInventoryPage` (RSC) forwards `searchParams` to `InventoryListView`.

1. Requires inventory read.
2. Parses `q` / `search`, `page`, and `low_stock` (`true` / `1`).
3. Loads **one** `GET /admin/inventory` page via `listInventory()`:
   `page`, `limit=20`, `search`, `low_stock`, `sortBy=updated_at`, `orderBy=desc`.
   Do **not** call `listAllInventory()` — that walks every page of 100.
4. KPI cards:
   - SKU count = unfiltered `pagination.total_items` (cheap `limit=1` when the
     list itself is filtered).
   - Low stock = `low_stock=true` `pagination.total_items` (BE:
     `available_stock <= reorder_point`, includes out of stock).
   - Out of stock / missing weight / stock value are **this page only**
     (no catalog-wide filter). Money is still a decimal **string** — JS
     `Number` is display-only.
5. Search and low-stock are GET filters on `/admin/inventory` (whole catalog).
   DataTable facets (category / status / critical / weight) still apply to the
   current page only.
6. Out-of-range `page` redirects to the last page, preserving `q` + `low_stock`.
7. A failed `listInventory()` is **not** an empty warehouse. `InventoryListResults`
   renders `AdminDataErrorState` («دریافت موجودی ناموفق بود») with the shared
   `router.refresh` retry — header and GET filters stay on the page. Auth
   `401`/`403` still throw to `app/admin/error.tsx`. Zero results stay a
   distinct empty state («هنوز ردیف موجودی ندارید» / «رکورد موجودی مطابق این
   جستجو پیدا نشد»).

### Columns / sort (API-backed)

List request sort is `updated_at desc` (BE default; inventory `id` is the
secondary key). Supported `sortBy` values remain `id`, `updated_at`,
`stock_on_hand`, `available_stock`, `reorder_point`, `product_title`, `sku`.  
Search: product title or SKU (`q` on the admin URL → API `search`).  
Filter: `low_stock=true`.

Always show **available** prominently; showing only on-hand misleads buyers of
reserved stock.

The admin-home `LowStockList` widget uses the same `InventoryItem` fields.
It prints `product_title` (then `sku`, then variant id) — never a fabricated
name. `GET /admin/inventory/low-stock` is paginated; the widget unwraps
`results`. This is not the inventory list page (that board is separate).

---

## Variant detail

Typical sections:

- Current on-hand / committed / available
- Reorder point & quantity form (`INVENTORY_WRITE`)
- Adjust stock popover (same control as list; quick restock chips + signed delta)
- Movement history table (paginated or full list by variant)

### Allowed adjust types (UI must match backend)

| Type | Quantity |
|------|----------|
| `restock`, `refund` | positive |
| `purchase`, `damage` | negative |
| `adjustment` | non-zero signed |
| `reservation`, `release` | **not** in admin adjust — system-owned |

Validations live in `features/admin/inventory/validations.ts` (+ unit tests).
Mirror backend `validInventoryAdjustment` rules so users fail fast.

After a successful mutation:

- Invalidate inventory query keys.
- If product catalogue caches depend on availability, rely on existing admin
  revalidation where product writes happen; pure inventory adjust may need a
  product tag bust if the storefront stays stale — check
  [media-and-cache](./media-and-cache.md) when changing this.

---

## Status chips

`InventoryStatus` in types: `in_stock` | `low` | `out` — derived client-side
from available vs reorder point. Keep derivation consistent with list KPIs.

---

## Do / don’t

| Do | Don’t |
|----|--------|
| Use BFF `/api/admin/…` inventory paths | Call Go host from the browser |
| Trust server errors for insufficient stock | “Clamp” stock in the UI and pretend success |
| Show a retry card when the list GET fails | Swallow `listInventory()` into `[]` / empty copy |
| Label available vs committed clearly in Persian | Invent a third stock field |
| Test validations with vitest | Skip tests when changing sign rules for movement types |

---

## Tests

- `features/inventory/api.test.ts`, `actions.test.ts`
- `features/admin/inventory/validations.test.ts`
- `features/admin/inventory/inventory-list-params.test.ts`
- `features/admin/inventory/components/inventory-list-view.test.ts`
- `app/admin/inventory/page.test.ts`
- `app/admin/inventory/[variantID]/page.test.ts`
- Backend unit: `inventory_svc_test.go`
- Backend integration: `tests/integration/inventory_test.go`

---

## Related journeys

- Checkout oversell protection → backend reserve in CreateOrder  
- Payment fail → release; payment success → deduct  
- Storefront product card availability → catalogue presentation (not this module)  
