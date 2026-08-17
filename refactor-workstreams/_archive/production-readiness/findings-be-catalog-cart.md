# Findings — be-catalog-cart

**Workstream:** `production-readiness-20260816`  
**Agent:** `be-catalog-cart`  
**Date:** 2026-08-16  
**Mode:** investigation only — no application code changed.

---

## What I inspected (paths)

### Backend catalog
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/brand/{routes,handler,service,repository,model}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/tag/{routes,handler,service,repository,model}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/category/handler.go` (list bind, same `limit` gate)
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/product/{routes,handler,service,repository,aggregate_handler,aggregate_service,aggregate_repository,model,model_aggregate}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/variant/{service,repository}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/option/handler.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/models/{filter,pagination,product_response}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/platform/httpx/{bind,errors}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/pkg/{response/{pagination,error,codes},apperr/apperr}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/routes/routes.go`
- Docs: `apps/backend/docs/{conventions.md,api/brands.md,api/tags.md,api/products.md,api/cart.md}`

### Backend cart / inventory
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/cart/{handler,service,repository,model,routes,service_test}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/inventory/repository.go`
- Migrations: `20260526174414_create_carts.sql`, `20260526174425_create_cart_items.sql`, `20260714130000_cart_inventory_integrity.sql`, `20260804170000_ensure_inventory_for_all_variants.sql`, `20260526174204_create_brands.sql`, `20260526174218_create_tags.sql`, `20260808173000_ensure_brand_slugs.sql`

### FE↔BE contracts touched
- `apps/frontend/features/admin/products/components/product-editor-view.tsx`
- `apps/frontend/features/admin/products/components/{ProductForm,product-form/TagSelector,product-form/GeneralInfoSection}.tsx`
- `apps/frontend/features/admin/{brands/client,tags/api}.ts`
- `apps/frontend/features/admin/products/api/server.ts`
- `apps/frontend/lib/api/{client,types,base,public}.ts`
- `apps/frontend/app/api/{admin,store,public}/[...path]/route.ts`
- `apps/frontend/features/cart/{api,types,components/add-to-cart-button}.tsx`
- `apps/frontend/features/catalog/products/{components/product-card-actions.tsx,catalogue-presentation.ts,repository.go purchasable SQL}`
- `apps/frontend/features/admin/recipes/components/recipe-editor-view.tsx`
- `apps/frontend/features/catalog/tags/api/public.ts`

Did **not** re-open closed PH/BE/Refactor-Docs work. The cart unique-index miss is a **live** bug, not a redo.

---

## PR-001 — Admin product form lookups empty

### PR-001a — Brand select empty even though brands exist

**Root cause (high confidence): FE sends `limit=200`; BE rejects any `limit` outside 1–100 as `400 INVALID_QUERY`; the editor swallows the error to `[]`.**

Evidence:

1. Product editor SSR lookup:

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
```

2. Hard query gate (this runs **before** `Defaults()` can clamp the limit):

```131:148:apps/backend/internal/platform/httpx/bind.go
func validBaseQuery(c *gin.Context) bool {
	// ...
	if raw, present := c.GetQuery("limit"); present && raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			return false
		}
	}
```

`BindQuery` then writes `400 INVALID_QUERY` (`bind.go:118–120`). Documented max is 100 (`docs/conventions.md:101`).

3. Envelope is **not** the bug. Lists are top-level `{results, pagination}` (`pkg/response/pagination.go:18–21`, `docs/conventions.md:33–51`). `apiFetch` unwraps `data` only when present (`lib/api/client.ts:72`), then `.results` is correct.

4. Why the founder still “has brands”: `/admin/brands` table calls `listBrands({ limit: 100 })` → `/api/admin/brands?limit=100` → public `GET /api/v1/brands` (`features/admin/brands/client.ts:57–60`). That query is legal, so the brands page is full while the product form is empty.

5. Routes / RBAC are not the cause:
   - Public: `GET /brands`, `GET /brands/:id`, `GET /brands/slug/:slug` (`brand/routes.go:10–12`, mounted in `routes.go:117`).
   - Admin writes only: `POST/PATCH/DELETE /admin/brands` behind `products:write` (`routes.go:220`). **There is no `GET /admin/brands`.**
   - Brands have no `is_active` filter (`brand/model.go:51–56`). Public list returns every row.

6. Same 400 applies to **categories** on the same form (`/categories?limit=200`). If brands are empty, category select is likely empty too.

**Not a `results` vs `data` mismatch.** Admin brands client already does `(body.data ?? body)` and reads `.results`.

### PR-001b — Tag select empty even though tags exist

**BE list contract is healthy for the path the product form actually calls.** If the picker is empty, it is almost certainly FE/BFF/session or error UI — not a missing Go route or a `limit=200` reject.

Evidence:

1. Tags are **not** loaded in `loadProductLookups`. `TagSelector` uses client `useAllTags` → `listAllTags` (`TagSelector.tsx:30`, `features/admin/tags/api.ts:104–141`).
2. That request is `GET /api/admin/tags?page=1&limit=100&sortBy=title&orderBy=asc`. Admin BFF allowlists `tags` (`app/api/admin/[...path]/route.ts:30–36`) and forwards to public `GET /api/v1/tags`.
3. `limit=100` is **valid**. `sortBy=title` and `orderBy=asc` are allowed (`tag/repository.go:98–111`). Envelope is `{results, pagination}`. `listAllTags` reads `first.results` / `first.pagination.total_pages`.
4. Public `GET /tags` + `GET /tags/:id` (`tag/routes.go:10–11`). Admin writes `POST/PATCH/DELETE /admin/tags` require `tags:manage` (`routes.go:221`). **No `GET /admin/tags`.**
5. Repo scan is explicit (`scanTag` includes `slug`) so `db:"-"` on `Tag.Slug` does **not** break list (`tag/model.go:18`, `tag/repository.go:247–258`).
6. Product write of tags is already implemented: aggregate `tag_ids` (`model_aggregate.go:24`) and `PUT /admin/products/:id/tags` (`handler.go:347–362`).

If `/admin/tags` board shows data (same `listAdminTags` / `useAdminTags` at `limit=20`) but the product picker is empty, inspect the browser call to `/api/admin/tags?limit=100` (401/403 vs 200 + empty `results`). BE does not filter “unused” tags.

Related FE landmine (not the product form): recipe editor `listTags({ limit: 200 })` (`recipe-editor-view.tsx:19`) will 400 the same way as brands.

---

## PR-004 — Add-to-cart on product cards returns 500 `INTERNAL_ERROR`

**Root cause (high confidence): `carts.user_id` has no UNIQUE constraint, but `GetOrCreate` uses `ON CONFLICT (user_id)`. Postgres fails; the service replaces the error with bare `apperr.ErrInternal` → `500 INTERNAL_ERROR`.**

This runs on **every** authenticated cart read or mutate (`Get`, `AddItem`, `AddItems`, `UpdateItem`, `RemoveItem`, `Clear`).

Evidence:

1. Founder payload matches the generic envelope (`pkg/response/codes.go:15`, `apperr.go:40`).
2. Handler requires JWT uid (`cart/handler.go:36–50`, `httpx.UID` → 401 if missing). Store BFF also requires a session (`app/api/store/[...path]/route.ts:53–58`). Guest cannot produce this 500.
3. Add-item service:

```67:110:apps/backend/internal/features/cart/service.go
	variant, err := s.variantRepo.GetByID(...)
	// not found → ErrProductNotFound; inactive → ErrProductUnavailable
	cart, err := s.cartRepo.GetOrCreate(ctx, userID)
	if err != nil {
		return nil, apperr.ErrInternal
	}
```

4. GetOrCreate SQL:

```36:42:apps/backend/internal/features/cart/repository.go
		INSERT INTO carts (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE
			SET updated_at = NOW()
		RETURNING *
```

5. Migration only creates a **non-unique** index:

```2:10:apps/backend/migrations/main/20260526174414_create_carts.sql
CREATE TABLE IF NOT EXISTS carts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    ...
);
CREATE INDEX idx_carts_user_id
ON carts(user_id);
```

No later migration adds `UNIQUE (user_id)`. Contrast wishlists (`user_id BIGINT NOT NULL UNIQUE`) and `cart_items` (`uq_cart_items_cart_variant` in `20260714130000_cart_inventory_integrity.sql`).

6. Postgres error: `there is no unique or exclusion constraint matching the ON CONFLICT specification`. That is **not** in `httpx.domainErrors`. Service drops the wrap → silent 500. `HandleError` comments this class of bug (`httpx/errors.go:12–15`) but cart already mapped the failure away.

7. **Not** the stock sentinel. Missing inventory → `ErrOutOfStock` (`service.go:184–194`). Inactive variant → `ErrProductUnavailable`. Unknown variant → `ErrProductNotFound`. Those are 4xx.

8. Product cards: `purchasable_variant_id` is a real variant id, only when there is **exactly one** active variant with sellable stock (`product/repository.go:429–438`). `AddToCartButton` posts `{product_variant_id, quantity}` (`cart/api.ts:16–50`, `add-to-cart-button.tsx:66–67`). If the 500 happens on those cards, the variant id is almost certainly valid.

9. No cart integration test hits `GetOrCreate` against Postgres (`cart/service_test.go` only tests `ensureAvailable`). `inventory_test.go` inserts into `carts` directly.

**Secondary 500 risk after the unique index is added:** service still maps every unexpected repo error to `ErrInternal` with no log (`service.go:83–88`, `103–107`). `GetItems` does not load `options` even though `CartItemResponse` and `docs/api/cart.md:52–54` advertise them — that is a contract hole, not this 500.

---

## Missing / incomplete / not production-ready

### Catalog lookups
- No dedicated admin lookup (`GET /admin/brands`, `GET /admin/tags`). Staff reuse public lists. Fine if FE respects `limit≤100` and does not swallow 400s.
- Invalid `limit` is a generic `INVALID_QUERY` with **no field map**, so FE cannot tell the operator what to fix.
- `BaseFilter.Defaults` clamps `limit>100` to 20 (`models/filter.go:14–16`) but never runs when `validBaseQuery` rejects first.

### Product writes
- Aggregate and legacy create accept `brand_id` and `tag_ids`. That contract is live and used by `ProductForm.toAggregatePayload`.
- Aggregate variant insert (`aggregate_repository.go:341–347`) and `insertVariantTx` (`repository.go:140–171`) **do not** call `inventory.EnsureForVariant`. Standalone `variant.Service.Create` does (`variant/service.go:53–57`).
- One-shot backfill `20260804170000_ensure_inventory_for_all_variants.sql` does not cover variants created later via the editor. New admin products can exist with **no inventory row** → `purchasable_variant_id` stays null → no card add; if someone posts a variant id anyway, `ensureAvailable` returns `OUT_OF_STOCK` (4xx), not 500.
- Create product does **not** require a variant (`validateCreateProductReq` is title-only, `service.go:391–399`). A product without variants cannot be added to cart.
- `GET /admin/products` list is implemented (`product/routes.go:36`, `handler.go:87–104`) but **omitted** from `docs/api/products.md` route table.
- Brand `Update` uniqueness check `ExistsByTitle` does **not** exclude the current id (`brand/service.go:104–110`). PATCH with the same title conflicts with itself.

### Cart / stock
- Auth-only cart. No guest cart, no merge. Documented in `docs/api/cart.md`; store BFF enforces login. Fine if product is login-gated; not a storefront guest checkout.
- Cart checks stock, **does not reserve**. Two checkouts can race the last unit (order layer must reserve). Nearby, not the founder 500.
- `AddItem` does not check parent `products.is_active`. Inactive product + active variant can be added; `GetItems` then inner-joins `p.is_active = true` and **hides** the line (`repository.go:219–220`).
- `POST /cart/items/bulk` is mounted (`cart/routes.go:16`) but missing from the cart docs table.
- `Cart.UserID` is `*int64` “for guests” (`cart/model.go:15`) but no guest path exists. A future unique index on `user_id` must be `UNIQUE (user_id)` (currently NOT NULL in practice) or a partial unique if guests are added.

### Indexes
- **P0 missing:** unique on `carts.user_id`.
- Brands: unique `title`, unique `slug` (later migration). Tags: unique `title`/`slug`.
- ILIKE search on brands/tags has no trigram index (P2).

### Silent 500s
- Cart (and several catalog services) return `apperr.ErrInternal` and discard the SQL error. Operators see only `an unexpected error occurred`.
- `response.HandleError` even has the log line commented out (`pkg/response/error.go:66–68`).

---

## Proposed lettered tasks

Do not replace PR-001a/b or PR-004a/b; implement those with the evidence below. New IDs are extras.

| ID | Lane | Sev | Effort | Why | Key files |
| --- | --- | --- | --- | --- | --- |
| **PR-001a** | both | P0 | S | Product form `GET /brands?limit=200` is 400; swallow → empty brand select. FE must use `limit≤100` (or page) and **not** catch-all to `[]`. BE stays at max 100 unless PR-010g. | `product-editor-view.tsx`; `httpx/bind.go:131–148`; `brand/handler.go:35–48` |
| **PR-001b** | both | P0 | S | Tag list BE is valid at `limit=100`. Confirm `/api/admin/tags` in the browser. FE: surface hook errors; optionally SSR tags in `loadProductLookups` with `limit=100`. Do not invent `GET /admin/tags` unless you want an alias. | `features/admin/tags/api.ts`; `TagSelector.tsx`; `tag/handler.go:35–48` |
| **PR-001c** | fe | P0 | S | Same `limit=200` on categories in the product form, and `listTags({limit:200})` in the recipe editor. | `product-editor-view.tsx`; `recipe-editor-view.tsx` |
| **PR-004a** | be | P0 | S–M | Add **UNIQUE** on `carts.user_id` (and NOT NULL if guests stay unsupported). This is the 500. Add a real DB test for `GetOrCreate` + `POST /cart/items`. | `migrations/main/20260526174414_create_carts.sql`; new goose file; `cart/repository.go:36–54`; `cart/service.go:67–110` |
| **PR-004b** | fe | P0 | S | Human error for `INTERNAL_ERROR` / stock codes (already in TASKS). Confirm `product_variant_id` is `purchasable_variant_id`. | `add-to-cart-button.tsx`; `features/cart/errors` |
| **PR-010a** | be | P0 | M | `SaveAggregate` / `insertVariantTx` must `EnsureForVariantTx` so editor-created variants get an inventory row (standalone variant create already does). | `product/aggregate_repository.go:339–370`; `product/repository.go:140–171`; `inventory/repository.go:74–84`; `variant/service.go:53–57` |
| **PR-010b** | be | P1 | S | Stop collapsing cart repo errors to bare `ErrInternal`. Wrap + log the SQL cause; keep the public 500 envelope. | `cart/service.go`; `pkg/response/error.go:56–69` |
| **PR-010c** | be | P1 | S | `AddItem` must refuse inactive parent products (`ErrProductUnavailable`) so a line cannot be inserted then vanish on `GetItems`. | `cart/service.go`; `cart/repository.go:193–221` |
| **PR-010d** | be | P2 | S | Hydrate cart line `options` (docs + FE type already expect them). | `cart/repository.go:193–255`; `docs/api/cart.md` |
| **PR-010e** | be | P2 | S | Brand PATCH: `ExistsByTitle` must exclude current id (same pattern as tags). | `brand/service.go:104–110`; `brand/repository.go:283–291` |
| **PR-010f** | be | P2 | S | Document `GET /admin/products` (already mounted). Optionally document that brand/tag lists are public `GET /brands` / `GET /tags` (no admin GET). Add `POST /cart/items/bulk` to cart.md. | `docs/api/products.md`; `docs/api/cart.md`; `docs/api/brands.md`; `docs/api/tags.md` |
| **PR-010g** | be | P2 | S | Optional: allow a higher lookup cap (e.g. 200) **or** `GET /admin/catalog-lookups` for typeahead. Only if FE refuses to page at 100. Not required to fix PR-001. | `httpx/bind.go`; `models/filter.go` |

---

## Cross-notes for other agents

### fe-admin-catalog
- Do **not** change the paginated envelope. It is `{results, pagination}`.
- `GET /admin/brands` and `GET /admin/tags` do not exist. Proxy `/api/admin/brands` and `/api/admin/tags` to the public lists.
- Product save already sends `brand_id` + `tag_ids` on `/admin/products[/ :id]/aggregate`. No extra tag sync call is required on that path.
- Stop swallowing lookup failures. `limit=200` is illegal today.
- Categories on the same form share the brand bug.

### fe-cart-loyalty
- Add-to-cart is **auth-only**. 401 from the BFF is expected for guests; founder 500 is Go after login.
- Body: `{product_variant_id, quantity}`. Success `201 {data: Cart}`.
- If `GET /api/store/cart` is also 500, that confirms GetOrCreate (PR-004a), not a bad variant id.
- Cards only expose add when `purchasable_variant_id` is set (single in-stock active variant). Multi-option SKUs must go to PDP.
- Cart line `options` are documented but currently always empty from BE (PR-010d).
- Loyalty earn is **after payment** (be-loyalty-money). Do not show points on add-to-cart / unpaid checkout.

### be-loyalty-money
- Acknowledged: no earn copy on unpaid cart. Out of this lane.

### Coordinator
- PR-004a implementation **is** the unique index + test. Do not also file a duplicate “rewrite cart service” task.
- Do not reopen PH cart-inventory integrity; that migration only fixed `cart_items`.
