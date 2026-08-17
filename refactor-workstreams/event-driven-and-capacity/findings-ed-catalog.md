# Findings — ed-catalog

**Workstream:** `event-driven-capacity-20260816`  
**Agent:** `ed-catalog`  
**Date:** 2026-08-16  
**Mode:** investigation only — no application code changed.

Catalog/content **writes stay HTTP + Postgres**. After commit, emit domain events
for side effects (Redis bust, Meili incremental upsert/delete, optional Next
tag revalidate). **Reads stay HTTP + JSON.** Do **not** event-source the
catalogue. Do **not** reopen PH-030a/b or propose Meili storefront cutover.

Depends on `ed-platform` **ED-000+** (generic outbox + envelope + relay). Do not
invent a second outbox; `notification_outbox` is notifications-only today.

---

## What I inspected (paths)

### Product aggregate + cache
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/product/{handler,cache,aggregate_handler,aggregate_service,service,repository,search_index,mapper,wire}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/{variant,category,brand,tag,option}/{handler,service}.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/pkg/cache/cache.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/tests/integration/product_aggregate_test.go`

### Search / Meili
- `/home/tehranspeaker/Videos/Rumera/apps/backend/pkg/meili/client.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/corn/meili_reindex_job.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/bootstrap/{app.go,container.go}`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/docs/architecture/search.md`
- `/home/tehranspeaker/Videos/Rumera/obsidian/11 Decisions/ADR Search ILIKE until Meili.md`

### Media + content
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/media/handler.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/recipes/handler.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/blog/handler.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/hero/handler.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/site_settings/handler.go`
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/inventory/handler.go`

### FE HTTP + ISR (contract only)
- `/home/tehranspeaker/Videos/Rumera/apps/frontend/lib/{cache-tags,admin-revalidation,apply-admin-revalidation}.ts`
- `/home/tehranspeaker/Videos/Rumera/apps/frontend/features/catalog/products/api/public.ts`

### Existing async primitive (do not reinvent)
- `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/notifications/postgres/store.go`
- `/home/tehranspeaker/Videos/Rumera/obsidian/11 Decisions/ADR Outbox Kafka notifications.md`

---

## Non-goals (locked)

| Do not | Why |
| --- | --- |
| Event-source products/categories/recipes | Postgres rows + aggregate `expected_updated_at` are the ledger. Events notify. |
| CQRS / separate catalogue read model | `GET /products`, `GET /products/slug/:slug`, `GET /categories/tree` stay HTTP. |
| Meili storefront cutover | PH-030b readiness only. Shopper search is `GET /products?search=` (ILIKE). |
| Browser / Next Kafka clients | Charter. FE keeps `listProducts` / BFF. |
| Dual-write API → Meili/Redis in the request TX | Same class of bug as notifications. Outbox in the write TX; consumer does I/O. |
| Stock/price as Meili truth | `MeiliProduct` has **no** inventory fields by design. Hydrate money from Postgres. |

---

## As-built (do not reinvent)

### Catalogue of record
- Product graph writes go through HTTP: `SaveAggregate` (optimistic `expected_updated_at` + `operation_id` replay) and granular PATCH/DELETE on product, variants, tags, images.
- Granular variant/image writes bump product revision so a stale aggregate save 409s (`TestGranularGraphWritesInvalidateAggregateRevision`).
- Public list/search is Postgres. Meili is optional derived index.

### Redis read-through (handler-local bust)

| Key | Writer | Reader | TTL | Bust today |
| --- | --- | --- | --- | --- |
| `product:v1:{id}` | product/variant/media handlers after HTTP 2xx | `GET /products/:id` and slug path (shared ID key) | 60s | Product update/delete/tags; variant CRUD/options; media product images |
| `category:v1:tree` | category handler | `GET /categories/tree` | 5m | Category create/update/delete |
| `recipe:v1:{slug}` | recipe + media owner upload | `GET /recipes/:slug` | 120s | Recipe update (new slug only); delete (best-effort pre-read); recipe owner image |
| `site_settings:v1:public` | settings handler | public settings GET | 300s | Admin PUT settings |

Implementation is copy-pasted `cachedJSON` + `invalidate` on each handler (`product/cache.go`, `category/handler.go`, `recipes/handler.go`). Delete is **after** commit, best-effort; Redis miss/circuit-open degrades to Postgres. TTL is the only safety net if the process dies between commit and `Delete`.

**CreateProduct** does not bust (no prior key). **Product lists are not Redis-cached.** Featured categories, brand/tag public GETs, hero, journal are **not** Redis-cached on the API.

### Meili (PH-030b readiness)
- `MEILI_ENABLED` default **false**. Fail-soft connect (`app.go:79–90`).
- `MeiliIndexer.FullReindex`: ensure settings → `DeleteAllDocuments` → batch 200 upserts of **every** product (`ListForSearchIndex`).
- Cron `0 30 4 * * *` UTC via `corn.MeiliReindexJob` when client non-nil.
- Client already has `UpsertDocuments` and **unused** `DeleteDocument`.
- **No** `GetForSearchIndex(id)`. **No** write-path hook.
- Documents include `is_active`, brand/category titles, tag titles, min/max **active** variant price. No stock.
- Storefront never queries Meili.

### FE cache (already HTTP)
- Next ISR/tags: product 60s, recipe/journal 3600s, hero 300s, category directory 3600s.
- Admin writes through `app/api/admin/[...path]` call `revalidateAfterAdminMutation` (`getAdminRevalidationPlan`). Direct API clients skip this.
- Inventory admin actions revalidate **admin** paths only, not `PRODUCT_CATALOGUE_CACHE_TAG`.

---

## Mutation → side-effect gaps

These are the work for ED-02x. Today side effects are **in-process after the handler succeeds**, not outbox events.

### Product / variant / tags
| Mutation | Redis `KeyProduct` | Meili | Event |
| --- | --- | --- | --- |
| Aggregate create/update | Yes (`aggregate_handler.go:38`) | No (stale until 04:30) | None |
| Aggregate replay (`operation_id` hit) | Still `invalidate` after return | — | Must not enqueue a second distinct event |
| PATCH/DELETE product, tag sync/attach/detach | Yes | No | None |
| Variant create/update/delete/options | Yes | No (price band / sku / active) | None |
| Inventory `AdjustStock` / checkout reserve | **No** (comment on `productCacheTTL` admits 60s stock lag) | N/A (no stock in index) | Money lane |
| Brand / tag / option title rename | **No** | **No** | None |
| Category title/tree write | Tree only; **not** `product:v1:*` | **No** | None |

### Media
| Mutation | Redis | Meili | Event |
| --- | --- | --- | --- |
| Product image upload/url/reorder/primary/alt/delete | `KeyProduct` | No (Meili has no images — OK) | None |
| `POST /admin/uploads/:ownerType/...` recipes | `KeyRecipe(ownerSlug)` | n/a | None |
| Category/hero/brand owner upload | **No** API Redis (category tree not busted from media) | n/a | None |
| Standalone `/admin/uploads` | None | n/a | None |

### Recipe / blog / hero
| Mutation | API Redis | Next tags | Event |
| --- | --- | --- | --- |
| Recipe create | None (OK until first GET) | BFF only | None |
| Recipe update | `KeyRecipe(new slug)` only — **old slug survives 120s** | BFF only | None |
| Recipe delete | Best-effort get-then-bust | BFF only | None |
| Blog create/update/delete | **No Redis key** | BFF `JOURNAL_CACHE_TAG` (3600s if missed) | None |
| Hero create/update/reorder/delete | **No Redis key** | BFF `HERO_CACHE_TAG` (300s if missed) | None |

### Search index projection
`ListForSearchIndex` joins brand title, category title, tag titles, min/max **active** variant price. A brand rename, category rename, tag rename, or variant price/active flip **changes the document** without a product-row write. Incremental indexer must accept those fan-out IDs, not only `products.id` updates.

Inactive products **are** indexed (`is_active` filterable). Delete must `DeleteDocument`. Unpublish (`is_active=false`) should **upsert**, not delete.

---

## Proposed lettered tasks (ED-020+)

| ID | Lane | Sev | Effort | Why | Key files |
| --- | --- | --- | --- | --- | --- |
| **ED-020** | ed-catalog + ed-platform | P1 | M | Catalog event **contract**: types, payload (entity, id, op, `updated_at`/revision, optional `related_ids` / `old_slug`), idempotency key, consumer-rereads-Postgres rule. Not a snapshot log. Depends ED-000 envelope. | new events doc + types next to outbox; do not extend `notification_outbox` topics ad hoc |
| **ED-021** | ed-catalog | P1 | M | Enqueue from **product** writes in the **same Postgres TX** as the mutation: `SaveAggregate` (including create), Update, Delete, tag sync/attach/detach, variant CRUD/options. Replay of `operation_id` uses the same idempotency key (no extra side effects). Handler Redis `Delete` may stay as a fast path. | `product/{aggregate_service,service,aggregate_repository}`, `variant/service` |
| **ED-022** | ed-catalog | P1 | M | **Incremental Meili consumer**: `GetForSearchIndex(ids)`, upsert batch, `DeleteDocument` on hard delete. Idempotent on `(product_id, updated_at)`. Nightly `FullReindex` stays the backstop. Skip when `MEILI_ENABLED=false` / client nil. **No** `GET /products?search=` cutover. | `search_index.go`, `pkg/meili/client.go`, `corn/meili_reindex_job.go` |
| **ED-023** | ed-catalog | P1 | S | **Cache-bust consumer** for `KeyProduct`, `KeyCategoryTree`, `KeyRecipe` (+ `old_slug`). Cross-instance + crash-after-commit. Keep TTL as degrade path. Do not introduce list-key SCAN. | `pkg/cache/cache.go`; consumer next to ED-000 relay |
| **ED-024** | ed-catalog | P1 | M | **Taxonomy fan-out.** Brand / category / tag / option-value title (or delete) emits one event; consumer resolves affected `product_id`s then reuses ED-022/023. Today these writes do not touch `product:v1:*` or Meili titles. Category tree bust stays. | `brand`, `category`, `tag`, `option` services |
| **ED-025** | ed-catalog | P2 | M | **Media + content events.** Product media → `product.updated`. Recipe update/delete include **both** slugs. Recipe/blog/hero publish/unpublish/reorder/delete emit content events. Category/hero owner uploads must also bust tree/home consumers. Blog/hero have no API Redis today — event is for FE revalidate + future cache, not a new journal Redis unless claimed. | `media/handler.go`, `recipes/{service,handler}`, `blog/service`, `hero/service` |
| **ED-026** | ed-catalog + ed-money | P2 | S | **Inventory / price band.** Variant **price/active** already busts Redis in-handler but not Meili — covered by ED-021/022 if variant emits. `AdjustStock` and checkout reserve/commit do **not** bust `KeyProduct` (60s stale PDP stock). Emit `inventory.stock_changed{product_id,variant_id}` for cache-only (not Meili). Do not put available stock in Meili. | `inventory/{service,handler}`; money lane owns reserve/commit |
| **ED-027** | ed-catalog + ed-frontend | P2 | S | **HTTP contract + staleness.** Document: shopper/admin reads unchanged; eventual windows (API TTL 60s/5m/120s until ED-023; Next ISR 60s–3600s unless admin BFF revalidate). Keep `revalidateAfterAdminMutation`. Optional later internal revalidate webhook — **not** required to land ED-021–025. No Kafka on FE. | `admin-revalidation.ts`, `cache-tags.ts`; charter note for ed-frontend |

**Not proposed:** Meili query cutover; event-sourced catalogue; Redis-caching product lists; browser search against Meili; gift/site-settings lock (PR-021, other workstream); ILIKE SKU leftovers.

---

## Suggested event shapes (for ED-020; not implemented)

Consumers **re-read Postgres** (or run `GetForSearchIndex`) and ignore unknown fields.

```
catalog.product.changed.v1
  product_id, op: upsert|delete, updated_at, source: aggregate|patch|variant|tags|media|inventory

catalog.taxonomy.changed.v1
  kind: brand|category|tag|option_value, id, op, updated_at
  # consumer expands to product_ids

content.recipe.changed.v1
  recipe_id, op, slug, old_slug?, updated_at

content.blog.changed.v1
  post_id, op, slug, old_slug?, updated_at

content.hero.changed.v1
  slide_id?, op: upsert|delete|reorder, updated_at
```

Partition key = entity id. Idempotency = `{type}:{id}:{updated_at}` or aggregate `operation_id`.

---

## Cross-notes

### ed-platform
Need a **domain** outbox (or a generic one) in the same TX as catalog writes. Do not overload `notification_outbox` topic strings without an envelope version. Relay/consumer host is yours; we only specify catalog topics + idempotent handlers.

### ed-money
Stock/reserve stays transactional. ED-026 is notify-only so PDP cache drops. Do not have catalog consumers adjust inventory.

### ed-frontend
Do not change storefront fetch contracts. Admin BFF revalidate stays. If you later add a server-side revalidate endpoint for events, it is opt-in and authenticated; browsers still talk HTTP.

### ed-engagement
Search analytics (`search_performed` on `GET /products?search=`) is unchanged. Recs/alerts may listen to `catalog.product.changed` later — not required here.

### k6-suite
Useful later: admin product PATCH → assert Meili/Redis eventually consistent. Not blocking ED-020 design.

---

## Claim order (when founder assigns)

1. **ED-020** (contract) after or with ED-000.  
2. **ED-021** + **ED-023** (emit + Redis) — immediate PDP correctness under multi-instance.  
3. **ED-022** (Meili incremental) — only valuable once `MEILI_ENABLED` is on; still no cutover.  
4. **ED-024** (taxonomy) — Meili/PDP titles.  
5. **ED-025** / **ED-026** / **ED-027** — content + stock + FE note.
