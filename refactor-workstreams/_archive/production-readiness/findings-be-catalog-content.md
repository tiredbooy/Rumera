# Findings — be-catalog-content

**Workstream:** `production-readiness-20260816`  
**Agent:** `be-catalog-content`  
**Date:** 2026-08-16  
**Mode:** investigation only — no application code changed.

Wave 2 whole-project audit of catalog leftover + content. Did **not** re-propose claimed PR-001a–c, PR-010a/e/f/g, PR-011a. Did **not** reopen PH-030a/b or PH-060 unless a **new** live bug is proven.

---

## What I inspected (paths)

### Catalog leftover
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/product/{handler,service,repository,routes,slug,search_index,aggregate_service,model,model_aggregate}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/{brand,category,tag,option,variant}/{handler,service,repository,routes}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/migrations/main/{20260526174224_create_products.sql,20260526174324_create_product_variants.sql,20260812120000_search_normalize_and_trgm.sql}`

### Search / Meili
- `/home/tehranspeaker/Videos/Rumera/apps/backend/pkg/meili/client.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/corn/meili_reindex_job.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/bootstrap/{app.go,container.go}`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/middlewares/analytics.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/corn/search_job.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/docs/architecture/search.md`
- FE: `apps/frontend/features/catalog/products/api/public.ts`, `apps/frontend/features/storefront/search/components/search-view.tsx`

### Media
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/media/{handler,service,routes,validation,lifecycle_repository}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/pkg/storage/{storage.go,local.go}`

### Content
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/blog/{handler,service,repository,routes,model}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/recipes/{handler,service,repository,routes}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/hero/{handler,service,repository,routes,validation,mapper}.go`

### Site settings (incl gift)
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/site_settings/{service,repository,handler,routes,model,gift,mapper}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/orders/gift_options.go`
- FE: `apps/frontend/features/settings/{types.ts,form-utils.ts,api/client.ts}`

---

## Re-verify historical hints

### IMPROVEMENT 5.9 — site-settings lock — **STILL LIVE**

`Update` is still Get → merge-in-Go → upsert with **no** `FOR UPDATE`, version, or `expected_updated_at`.

```38:50:apps/backend/internal/features/site_settings/service.go
func (s *service) Update(ctx context.Context, req UpdateSiteSettingsReq) (*SiteSettings, error) {
	cur, err := s.repo.Get(ctx)
	// ...
	merged := req.Apply(*cur)
	updated, err := s.repo.Update(ctx, merged)
```

Repo upsert writes the **entire** JSONB blob (`repository.go:73–84`). Two concurrent admin PUTs last-write-win the whole document, even when they touched different groups.

Admin FE always sends **every** group (`toSettingsPayload` “full wholesale-replace”, `form-utils.ts:194–242`). `updatedAt` is displayed/stored on the form (`form-utils.ts:107`) and **never** sent back. Product aggregate already has `expected_updated_at`; settings does not.

Cache invalidation after write works (`handler.go:70–76`). That does not fix the lost-update.

**Not a redo of PH-060.** Gift group is shipped (see below). This is the original concurrency hole.

### IMPROVEMENT 6.18 — slug fallback — **FIXED** (do not re-open)

Original bug: FE `getProductBySlug` searched then took `results[0]`. Current FE is exact:

```73:94:apps/frontend/features/catalog/products/api/public.ts
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  try {
    return await publicRequest<ProductDetail>(
      `/products/slug/${encodeURIComponent(slug)}`,
```

BE: `GET /products/slug/:slug` (`product/routes.go:11`) → `GetBySlug` exact `WHERE slug = $1 AND is_active = true` (`repository.go:215–218`). Tests lock this (`public.test.ts:31–44`). Cards refuse a missing slug (`catalogue-presentation.ts:7–12`).

**New leftover (not 6.18):** product slugs are **not** slugified on write or lookup, unlike brand/category/recipe. See PR-022.

### Search residuals after PH-030a / PH-030b

| Hint | Live verdict |
| --- | --- |
| 6.7 title-only ILIKE | **Closed** PH-030a. Product list uses `rumera_search_normalize` on title + description + brand + category (`repository.go:254–272`). Trgm on **titles** of products/brands/categories (`20260812120000_search_normalize_and_trgm.sql:45–52`). |
| Description ILIKE | Still **no** trgm on `rumera_search_normalize(p.description)`. Large catalogs seq-scan description. |
| Code / SKU / tags / slug | **Not** in the ILIKE predicate. Shopper search cannot find SKU or tag titles. |
| Meili cutover | **Still deferred** by design. `MEILI_ENABLED` default false (`configs/config.go`). Client + nightly full reindex only (`app.go:79–90`, `CronMeiliReindexSchedule` `0 30 4 * * *`). Storefront still `listProducts({ search })`. No incremental write hooks. **Not a new live 500.** Do not reopen PH-030b unless founder wants cutover. |
| 5.8 empty search analytics | **Closed PR-070d.** `GET /products?search=` is `search_performed` with `query` + `results_count`. No `GET /search`. List errors do not invent zero hits. |

---

## Live bugs / production holes

### PR-020 — Price range filter can match products with no variant in range

`min_price` and `max_price` are **independent** `EXISTS` clauses, and they do **not** require `pv.is_active`:

```311:324:apps/backend/internal/features/catalog/product/repository.go
	if f.MinPrice != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM product_variants pv
			WHERE pv.product_id = p.id AND pv.price >= @min_price
		)`)
	}
	if f.MaxPrice != nil {
		where = append(where, `EXISTS (
			SELECT 1 FROM product_variants pv
			WHERE pv.product_id = p.id AND pv.price <= @max_price
		)`)
```

A product with variants at 10 and 1000 matches `min_price=100&max_price=200`. An **inactive** cheap/expensive variant can pull a product into a band that the card then prices from **active** variants only (`GetAll` LATERAL `pv.is_active`, `repository.go:439–441`).

The old 1.1 “aggregate in WHERE” 500 is gone. This is a **new** correctness hole on the same filters.

### PR-021 — Site settings last-write-wins (5.9)

See re-verify above. Two operators (or two tabs) can clobber gift/store/maintenance. Gift options are money-adjacent at checkout (`orders/gift_options.go:11–25`).

### PR-022 — Product public identity: optional un-normalized slug

- Create requires **title only** (`service.go:391–399`). Slug may be NULL (`products.slug` UNIQUE but nullable, `20260526174224_create_products.sql:6`).
- Aggregate only `TrimSpace`s slug (`aggregate_service.go:110,347–356`). It does **not** call `normalizePublicSlug` even though `product/slug.go` exists.
- `GetBySlug` trims only (`service.go:93–107`). Brand and category **do** normalize on read (`brand/service.go:73–78`, `category/service.go:200–204`). Recipe slugifies on write (`recipes/service.go:368–372`).
- Storefront PDP is slug-only. Empty slug → listed, no public href (`product-card.test.tsx:91–109`). Mixed-case / spaced admin slug 404s on the normalized URL shoppers expect.

### PR-023 — Search analytics never sees storefront search — **DONE PR-070d**

No public `/search` route. Live traffic is `GET /api/v1/products?search=`.
`ListProducts` now sets `AnalyticsPayloadKey` (`query` + `results_count`) after
a successful read; middleware classifies that list path as `search_performed`.

Cross-note: `fe-engagement` / analytics lane — classifier lives in `middlewares/analytics.go`.

### PR-024 — Discovery residuals (SKU / tags / description index)

ILIKE residual after PH-030a: no match on `p.code`, variant SKU, tag titles, or slug. Description is searched but unindexed. Placeholder copy on `/search` already says “نام محصول، برند یا دسته” (`search-view.tsx:65`) — SKU/tag search would be extra, confirm with FE.

### PR-025 — Recipe slug races 500

- `uniqueSlug` treats **repo error as “free”** (`service.go:394–398`: `if err != nil || !exists { return slug }`).
- `assertSlugFree` runs **outside** the write tx (`service.go:157–159`).
- `Create` does **not** map unique-violation → `ErrConflict` (`repository.go:256–282` wraps raw SQL).
- Blog create **does** take `pg_advisory_xact_lock` (`blog/service.go:193–195`). Recipes do not.

Two concurrent “Old Fashioned” creates can 500 instead of 409. Update slug check is also TOCTOU (`service.go:222–237`).

### PR-026 — Published + future `published_at` is already public

**Journal (PR-070g):** public list/detail now require `published_at IS NULL OR published_at <= NOW()`. Admin list/detail unchanged.

**Recipes (PR-070g):** public list/featured/related/sitemap/`GET /recipes/:slug`/product cross-sell now require `published_at IS NULL OR published_at <= NOW()`. Admin list/detail unchanged.

### PR-027 — Journal/recipe list search is raw ILIKE (not Persian-normalize)

`blog/repository.go:318–320` and `recipes/repository.go:149–151` use `title ILIKE` / `excerpt ILIKE` without `rumera_search_normalize`. Arabic-yeh vs Persian-yeh miss that PH-030a already fixed for products.

---

## Verified healthy / already shipped (do not re-task)

### Gift settings (PH-060) — live
- JSONB group + admin PUT + public GET (`site_settings/model.go:77–117`, `mapper.go:3–14`).
- Defaults + normalize (`gift.go:8–66`).
- Orders price selected option IDs (`orders/gift_options.go`, `orders/service.go:230–232`).
- Admin FE Gift tab exists (`SettingsForm.tsx` / `GiftSection.tsx`).
- Zero-value document still defaults to gift-on + free wrap (`gift.go:30–34`, `model_test.go:28–31`). After Apply, `MessageMaxLength` is clamped 1–500 so an explicit disable **does** persist. Not a disable-is-impossible bug.

### Media / uploads — production-shaped
- Signature + size + dimension guards; owner-aware keys; `/media/*key` transform; `ValidateKey` blocks `..`.
- External URLs: https or root-relative, **not** `/media/` spoof (`NormalizeExternalImageURL`, `service.go:407–428`).
- Product image URL attach does **not** fetch remote bytes (no SSRF).
- Release + lifecycle reconciliation exist. Not claiming orphan-GC as P0.

### Hero — hardened
- Public list: active + non-empty image + schedule window (`hero/repository.go:66–73`).
- CTA href allow-list (root-relative or https, rejects `javascript:`) (`validation.go:161–214`, tests).
- Active slide requires image (`validation.go:173–175`).
- Unbounded list is acceptable for a handful of slides.

### Blog public vs admin split
- Public list forces `published` (`blog/handler.go:37–38`).
- Public get is `GetPublishedBySlug`. Drafts stay on admin `GET /admin/blogs/:id`.
- Slug writes use advisory lock (better than recipes).

### Catalog already claimed (skip)
- PR-010a inventory on aggregate create.
- PR-010e brand PATCH self-unique.
- PR-010f docs.
- PR-010g lookup cap.
- PR-011a admin product list pagination.
- PR-001a–c `limit=200`.

### Product list pagination / price-filter 500 / Meili readiness
- Public `GET /products` paginated, `limit` 1–100, `is_active` forced (`handler.go:67–77`).
- 1.1 invalid price SQL is rewritten (`repository.go:237–240`).
- PH-030b indexer + cron exist; storefront not cut over (intentional).

---

## Adjacent notes (not proposed unless another lane wants them)

- Product Redis cache TTL 60s is **not** invalidated by inventory writes (no `KeyProduct` in inventory feature). PDP stock can be stale for a minute. Cross `be-money-ops`.
- Option types/values lists are unbounded (`option/repository.go:70–72`). Fine for a small catalog; product-form N+1 is already PR-011c (FE).
- Blog categories `GetAll` unbounded (`blog/service.go:60–65`). P2.
- Recipe `Related` uses only the first tag (`recipes/service.go:98–100`). Weak rail, not a contract break.
- SearchView swallows `listProducts` errors to `[]` (`search-view.tsx:22–27`). FE-storefront.
- No guest/cookie cart (already non-goal).
- Do **not** invent `GET /search` unless FE wants a dedicated envelope; current contract is `GET /products?search=`.

---

## Proposed lettered tasks (PR-020+)

| ID | Lane | Sev | Effort | Why | Key files |
| --- | --- | --- | --- | --- | --- |
| **PR-020** | be | P1 | S | `min_price`+`max_price` are two EXISTS; inactive variants count. A product can match a band with no in-range active SKU. | `product/repository.go:311–324`; add repo test |
| **PR-021** | be | P1 | S | 5.9 still live. Lock singleton row in one tx, or require `expected_updated_at` / If-Match (product aggregate already has the pattern). | `site_settings/{service,repository,handler,model}.go`; FE can send `updatedAt` |
| **PR-022** | be | P1 | M | Slugify product slug on write + `GetBySlug`; auto-generate (or refuse `is_active` without slug) so PDP exists. | `product/{slug,service,aggregate_service,repository}.go` |
| **PR-023** | be | P1 | S | **DONE PR-070d.** Treat `GET /products` with non-empty `search` as `search_performed`; put `query` + `results_count` in payload. Do **not** add `/search` unless FE asks. | `middlewares/analytics.go`; `product/handler.go`; `internal/analytics/search.go` |
| **PR-024** | be | P2 | M | Optional: ILIKE code/SKU/tags + trgm on normalized description. Confirm FE copy first. | `product/repository.go:254–272`; new migration |
| **PR-025** | be | P1 | S | Recipe slug: advisory lock like blog; map 23505 → 409; `uniqueSlug` must not treat errors as free. | `recipes/{service,repository}.go` |
| **PR-026** | be | P2 | S | Recipes still need the schedule window. Journal shipped as **PR-070g**. | `recipes/repository.go:130–134` |
| **PR-027** | be | P2 | S | Journal + recipe `search` through `rumera_search_normalize` (same as products). | `blog/repository.go:318–320`; `recipes/repository.go:149–151` |

**Not proposed:** Meili storefront cutover (PH-030b residual, no live outage). Gift settings (shipped). 6.18 fallback (fixed). Media SSRF (URL stored, not fetched). Hero XSS href (already rejected).

---

## Cross-notes for other agents

### fe-storefront
- **6.18 is fixed** on BE + current `getProductBySlug`. If you still see a wrong PDP, it is not `results[0]`.
- Search contract today: Next `/search?q=` → `GET /products?search=`. No Go `/search`. Keep using `listProducts({ search })`. Do not call Meili from the browser (`products/types.ts:86`).
- Empty slug = no public page by design until PR-022.
- Price facets: if you send both `min_price` and `max_price`, BE can over-match until PR-020.
- Search analytics: `GET /products?search=` is `search_performed` (PR-070d / PR-023).

### fe-admin-ops
- `PUT /admin/settings` is partial-by-group on BE; **your form sends all groups**. `updatedAt` is unused. Two tabs last-write-win (PR-021). Gift tab is already the live contract (`gift.enabled`, `options[].id/price`).
- Recipes: slug unique is DB-enforced but races 500 (PR-025). Journal slugs are safer (advisory lock).
- Hero / journal / recipe public-vs-admin splits are real. Do not expect drafts on public GETs.
- Option catalog is `GET /admin/option-types` unbounded `{data:[]}` (not paginated). Product form N+1 is PR-011c.

### be-engagement
- Search summary job is correct **if** events exist. Producer is PR-070d (`GET /products?search=` → `search_performed`).

### be-money-ops
- Gift checkout reads `site_settings.GiftCheckout`. A clobbered settings PUT (PR-021) can change wrap prices mid-flight. Inventory does not bust product cache (60s stale PDP stock).

### Coordinator
- New IDs **PR-020–PR-027**. No collision with Phase 0 / PR-010 / PR-011.
- Do not reopen PH-030b or PH-060.
- Highest catalog leftover: **PR-020** (wrong search results) + **PR-021** (settings clobber, gift money) + **PR-022** (unsellable / 404 PDP) + **PR-025** (recipe 500).
