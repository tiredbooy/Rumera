# Findings — fe-admin-catalog

**Workstream:** `production-readiness-20260816`  
**Agent:** `fe-admin-catalog`  
**Date:** 2026-08-16  
**Mode:** Investigation only. No application code changed.

---

## What I inspected

| Area | Paths |
| --- | --- |
| Product editor shell | `apps/frontend/features/admin/products/components/product-editor-view.tsx` |
| Product form + success path | `…/ProductForm.tsx`, `ProductForm.behavior.test.tsx`, `ProductForm.integration.test.tsx` |
| Brand / category fields | `…/product-form/GeneralInfoSection.tsx`, `features/admin/shared/searchable-id-select.tsx` |
| Tags | `…/product-form/TagSelector.tsx`, `TagsSection.tsx`, `features/admin/tags/api.ts` (+ tests) |
| Save / images | `features/admin/products/api/client.ts`, `api/server.ts`, `actions/product.ts`, `ImagesSection.tsx`, `features/image-uploader/client.ts` |
| Variants / options | `VariantsSection.tsx`, `VariantRow.tsx`, `features/admin/options/api.ts`, `options/server.ts` |
| List | `app/admin/products/page.tsx`, `ProductsTable.tsx` |
| BFF vs direct API | `lib/api/client.ts`, `lib/api/base.ts`, `lib/api/public.ts`, `app/api/admin/[...path]/route.ts`, `app/api/public/…`, `app/api/store/…` |
| Backend contract (read-only) | `httpx.BindQuery` / `validBaseQuery`, brand/tag/category routes + list handlers, `response.Paginated`, product aggregate model |
| Adjacent same-bug | `features/admin/recipes/components/recipe-editor-view.tsx` (`listTags({ limit: 200 })`) |
| Founder text | `refactor-workstreams/READ_THIS_BEFORE_CHANGES.txt` items 1–2 |

---

## PR-001 — Brand and tag selects empty

### Request URLs the form uses today

| Lookup | Caller | Browser / RSC URL | Upstream |
| --- | --- | --- | --- |
| Brands | RSC `fetchList` | (server only) `apiFetch("/brands?limit=200")` | `{API_URL}/api/v1/brands?limit=200` |
| Categories | same | `apiFetch("/categories?limit=200")` | `{API_URL}/api/v1/categories?limit=200` |
| Tags | client `useAllTags` → `listAdminTags` | `GET /api/admin/tags?page=1&limit=100&sortBy=title&orderBy=asc` | BFF allowlist `tags` → `{API_URL}/api/v1/tags?…` |
| Option types | RSC `getProductOptionCatalog` | `GET {API_URL}/api/v1/admin/option-types` then N× `/admin/option-types/{id}/values` | staff JWT via `apiFetch` |
| Save create | `saveProductAggregate(null, …)` | `POST /api/admin/admin/products/aggregate` | `{API_URL}/api/v1/admin/products/aggregate` |
| Save edit | `saveProductAggregate(id, …)` | `PUT /api/admin/admin/products/{id}/aggregate` | `{API_URL}/api/v1/admin/products/{id}/aggregate` |

`/api/store` and `/api/public` are **not** on this form. Public catalogue BFF does not allow `/brands` or `/tags` (only `categories/tree` among catalogue paths). Admin BFF first-segment allowlist is `admin | products | categories | brands | tags | hero-slides`. Double `/api/admin/admin/…` is the documented BFF convention (prefix + backend `/admin/…` write path), not a doubled-path bug.

Envelope: Go `response.Paginated` is **top-level** `{ results, pagination }` (not `{ data }`). FE `apiFetch` / `tagRequest` do `body.data ?? body`, then list helpers read `.results`. That match is correct **when the request succeeds**.

### PR-001a — Brands empty (and categories, same hole)

**Root cause (FE + live BE query rule), not “no brands in DB”.**

1. `loadProductLookups()` always requests `limit=200`:

```18:33:apps/frontend/features/admin/products/components/product-editor-view.tsx
async function fetchList<T>(path: string): Promise<T[]> {
  try {
    return (await apiFetch<Paginated<T>>(path)).results ?? [];
  } catch {
    return [];
  }
}

async function loadProductLookups() {
  const [categories, brands, optionTypes] = await Promise.all([
    fetchList<Category>("/categories?limit=200"),
    fetchList<Brand>("/brands?limit=200"),
    getProductOptionCatalog(),
  ]);
```

2. Backend `BindQuery` → `validBaseQuery` **rejects `limit > 100`** (400/422 `INVALID_QUERY`):

```138:142:apps/backend/internal/platform/httpx/bind.go
	if raw, present := c.GetQuery("limit"); present && raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			return false
		}
	}
```

3. `fetchList` swallows that error and returns `[]`. The UI never sees a failure.
4. `GeneralInfoSection` passes `brands` into `SearchableIdSelect`. With `options=[]` the popover is only “بدون برند” / “موردی یافت نشد.” — matches the founder report.
5. Contrast: admin brands table works because `listBrands()` defaults to **`limit: 100`** (`features/admin/brands/client.ts` L57–60) and hits `GET /api/admin/brands?limit=100` → same public `GET /api/v1/brands`.
6. **Categories use the same `limit=200` + swallow.** Founder did not name them, but the category select will be empty for the same reason. There is no error/empty-catalog copy distinct from “no match”.
7. Edit mode: if `product.brand_id` is set but `brands=[]`, the select cannot show the current title (lookup by id against an empty list).

`GET /brands` is public (`brand/routes.go`); no staff token is required. `apiFetch` may attach a session token; that should not empty a public list. There is **no** `GET /admin/brands` list — writes only.

### PR-001b — Tags empty

Tags are **not** loaded in `loadProductLookups`. `TagSelector` uses client `useAllTags` → `listAllTags` → `listAdminTags` (`features/admin/tags/api.ts` L66–70, L104–141).

- Path is valid: `GET /api/admin/tags?page=1&limit=100&sortBy=title&orderBy=asc` (limit is legal).
- Backend list is public `GET /tags` (`tag/routes.go`); sort whitelist includes `title`.
- TagSelector already has pending / error+retry / empty copy (`TagSelector.tsx` L55–90). A **failed** fetch should show “بارگذاری فهرست برچسب‌ها ناموفق بود”, not a silent empty list.
- `listAllTags` is brittle: it reads `first.pagination.total_pages` with no guard (`api.ts` L111–112). A 200 with missing `pagination` throws → error UI.
- Writes (`createTag` etc.) correctly use `/api/admin/admin/tags`. Tests assert that (`api.test.ts` L85–96). Unrelated to the picker.

If the founder sees a **silent** empty picker while `/admin/tags` shows rows, remaining BE questions: does `GET /api/v1/tags?limit=100&sortBy=title&orderBy=asc` return `{ results, pagination }` with those rows? Does `scanTag` 500 the public list? FE should still stop relying on a second client hop and should load tags in `loadProductLookups` with `limit<=100` and **surface errors**.

### What `be-catalog-cart` must confirm

1. `GET /api/v1/brands?limit=200` and `GET /api/v1/categories?limit=200` are 4xx `INVALID_QUERY`.
2. `GET /api/v1/brands?limit=100` and `GET /api/v1/tags?page=1&limit=100&sortBy=title&orderBy=asc` are 200 `{ results, pagination }` when data exists (public).
3. No hidden admin-only list; product form should keep using public `/brands` `/tags` `/categories`.
4. Aggregate body below is accepted; no extra required field FE omits.

---

## PR-002 — After save, go to `/admin/products`

**Confirmed FE-only. Not a contract bug.**

**PR-002a shipped (2026-08-16).** Create and edit both toast then `router.push("/admin/products")` + `router.refresh()`. Tests lock the list destination.

```498:506:apps/frontend/features/admin/products/components/ProductForm.tsx
        if (mode === "create") {
          toast.success("محصول ایجاد شد");
        } else {
          toast.success("تغییرات ذخیره شد");
        }
        router.push("/admin/products");
        router.refresh();
```

| Mode | Actual (after PR-002a) | Founder want |
| --- | --- | --- |
| Create | `/admin/products` | `/admin/products` |
| Edit | `/admin/products` | `/admin/products` |

Cancel already goes to `/admin/products` (`ProductForm.tsx` L565, L707). Save toasts are after a real `saveProductAggregate` success — not fake.

Save URLs (for BE):

- `POST /api/admin/admin/products/aggregate`
- `PUT /api/admin/admin/products/{id}/aggregate`

Payload (`toAggregatePayload`): `operation_id`, optional `expected_updated_at`, `title`, `code`, `slug`, `category_id`, `description`, `brand_id`, `country_of_origin`, `abv`, `weight`, `is_active`, `meta_*`, `tag_ids`, `variants[]` (`id?`, `sku`, `price`, `compare_at_price`, `is_active`, `option_value_ids`), `images[]`. Matches `SaveProductAggregateReq` (`model_aggregate.go`).

---

## Other admin catalog gaps

Not fake-success / mock-catalogue on the product form. Storefront `getFeaturedBrands` fallbacks were storefront **PR-080i** (now live list only).

| Gap | Evidence | Severity |
| --- | --- | --- |
| Category select empty (same `limit=200` swallow) | `product-editor-view.tsx` L28 | P0 with PR-001a |
| Recipe tag lookup same `limit=200` + swallow | `recipe-editor-view.tsx` L17–22 | P1 (adjacent) |
| Lookup failures invisible | `fetchList` / `loadCategoryTree` catch → `[]` | P0/P1 |
| Product list hard-capped at 100, client-only search/filter | `app/admin/products/page.tsx` L15–18; no `has_next` UI | P1 |
| List fetch uncaught | same page — relies on `app/admin/error.tsx` only | P2 |
| List actions: edit + delete only | `ProductsTable.tsx` L137–156; duplicate omitted **on purpose** (comment L38–41) | P2 |
| No activate/deactivate / inventory adjust on list | inventory is a separate module; variant stock is display-only | P2 |
| Edit page is `PRODUCTS_READ` only | `app/admin/products/[id]/page.tsx` L10; form has no `canWrite` | P1 |
| `getProductOptionCatalog` N+1; any throw 500s the editor | `api/server.ts` L130–138; not swallowed | P1 |
| Product category picker is a **flat** list, not the tree | vs `CategoryForm` / `CategoriesTable` tree | P2 |
| Variant “موجودی” is read-only (`available_stock`) | `VariantRow.tsx` L94–100, L160–164; no stock field in aggregate | P2 (by design if inventory module is the writer) |
| Image upload is real deferred aggregate (`storage_key` / URL) | `ImagesSection.tsx`, `image-uploader/client.ts` `/api/admin/admin/uploads` | OK |
| Product list empty copy is generic DataTable “موردی یافت نشد.” | `DataTable.tsx` L71 | P2 |
| `uploadProductImage` still posts `/api/admin/admin/products/{id}/images` | `api/client.ts` L100 — leftover vs aggregate; unused by current ImagesSection | P2 |

---

## Proposed lettered tasks

| ID | Title | Lane | Sev | Effort | Why | Files |
| --- | --- | --- | --- | --- | --- | --- |
| **PR-001a** | Brand (and category) select: stop `limit=200`, stop swallowing | **both** | **P0** | **S** | Query is illegal (`limit>100`); errors become `[]`. Use `limit=100` (paginate if needed), throw or return a typed error, show empty/error in `SearchableIdSelect`. | `product-editor-view.tsx`, `searchable-id-select.tsx`; BE confirm `validBaseQuery` |
| **PR-001b** | Load tags with other lookups; keep error UI | **both** | **P0** | **S** | Picker depends on a second client hop; server should pass tags or fail visibly. Confirm `GET /tags` envelope. Guard `listAllTags` pagination. | `product-editor-view.tsx`, `ProductForm.tsx`, `TagSelector.tsx`, `features/admin/tags/api.ts` |
| **PR-001c** | Shared admin lookup helper (`limit≤100`, no swallow) | **fe** | **P1** | **S** | Same bug in recipe tags. One helper for brands/categories/tags. | `recipe-editor-view.tsx`, new small helper under `features/admin/` |
| **PR-002a** | After successful create/edit, `router.push("/admin/products")` | **fe** | **P1** | **S** | **Done 2026-08-16.** Founder requirement. Tests now assert `/admin/products`. | `ProductForm.tsx`, `ProductForm.*.test.tsx` |
| **PR-005a** | Product list server pagination + search | **both** | **P1** | **M** | `GET /admin/products?limit=100` silently drops the rest; DataTable only filters the first page. | `app/admin/products/page.tsx`, `ProductsTable.tsx`; confirm admin product list query keys |
| **PR-005b** | Product editor respects `PRODUCTS_WRITE` | **fe** | **P1** | **S** | Read-only staff can open edit and hit save; create page already requires write. | `app/admin/products/[id]/page.tsx`, `ProductForm.tsx` |
| **PR-005c** | Option catalog must not take down the product form | **fe** | **P1** | **S** | Isolate `getProductOptionCatalog` like lookups; show the existing “no options” empty state on failure + retry. | `product-editor-view.tsx`, `api/server.ts` |
| **PR-005d** | Category picker: tree / parent labels | **fe** | **P2** | **S** | Flat `/categories` hides hierarchy operators already see on `/admin/categories`. | `GeneralInfoSection.tsx`, `categories/api.ts` |
| **PR-005e** | Product list empty/error states (not only route error) | **fe** | **P2** | **S** | Failed `fetchAdminProducts` is a generic admin error; empty catalogue copy is generic. | `app/admin/products/page.tsx`, `ProductsTable.tsx` |

Do **not** re-open product-duplicate (intentionally omitted). Do **not** invent list “duplicate product” or fake stock writes.

---

## Cross-notes

### `be-catalog-cart`

Please confirm items 1–4 in the mid board post (limit 200 4xx; list envelopes; no admin list routes; aggregate field list).

FE save contract is already aligned with `SaveProductAggregateReq` (`brand_id`, `tag_ids`, variants, images, `operation_id`). PR-002 does not need a BE change.

If you find `GET /tags` 500s on `scanTag` / slug mapping (`db:"-"` vs selected `slug` column), that is a live PR-001b backend bug — call it out; FE will still add server-side load + visible errors.

### `be-loyalty-money` / `fe-cart-loyalty`

No catalog dependency. I did not inspect loyalty UI. Your proposed member/ledger routes are out of this lane. Storefront BFF not forwarding `Idempotency-Key` is `fe-cart-loyalty` + store BFF, not the admin product form.

---

## Decision needed from founder (when implementing)

PR-002: shipped — create and edit land on the list (`/admin/products`). Operators no longer stay in the editor after save.
