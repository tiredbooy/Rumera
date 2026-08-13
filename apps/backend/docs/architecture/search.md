# Search architecture

**Who this is for:** engineers changing storefront search, product list
`search=` filters, or admin “top search terms” analytics.

**Frontend UX:** [search.md](../../../frontend/docs/features/search.md)  
**Data stores:** [data-stores.md](./data-stores.md)

**Status (PH-030a):** product discovery is **Persian-aware Postgres ILIKE** (not Meili yet).

---

## Two different “search” systems

Rumera has **two** search-related pipelines. Do not conflate them.

| System | Purpose | Storage | Hot path |
|--------|---------|---------|----------|
| **A. Product discovery** | Shoppers find bottles | Main Postgres (`ILIKE` + normalize) | `GET /products?search=` |
| **B. Search analytics** | Admin sees what people typed | Analytics DB (`search_summary`) | Cron + admin analytics APIs |

Meilisearch appears in **config and types** as a planned full-text index, but is
**not wired into the running API bootstrap** today (client construction is
commented out). Treat Meili as **future/derived**, not current query authority.
Readiness work: **PH-030b**.

---

## A. Product discovery (current) — PH-030a

### Request path

```
Header search / /search?q=…
  → listProducts({ search: query })   # frontend public API
  → GET /api/v1/products?search=…&limit=…
  → product repository buildProductFilterSQL
  → rumera_search_normalize(column) ILIKE normalized(query)
```

**Code:**

- Frontend: `features/storefront/search/components/search-view.tsx`
- Frontend header: `features/storefront/navigation/components/header-search.tsx`
- Backend filter: `internal/features/catalog/product/repository.go` (`buildProductFilterSQL`)
- Go normalize: `pkg/searchtext` (`Normalize` / `LikeContains` / `EscapeLike`)
- SQL normalize: `rumera_search_normalize(text)` (migration `20260812120000_search_normalize_and_trgm.sql`)
- LIKE escape: `ESCAPE E'\\'` via `searchtext.EscapeLike` (prevents `%` / `_` injection)

Same `search` query param pattern is reused for admin/list endpoints on brands,
categories, recipes, blogs, coupons, shipping, inventory, users, etc. — each
with its own column set. **Only the product catalogue free-text path** uses the
Persian normalizer + multi-field OR today (storefront discovery). Other list
search endpoints remain simple `ILIKE` unless later extended.

### Normalization rules (Go + SQL lockstep)

Both the **query string** and **each matched column** pass through the same
rules so Arabic keyboard confusables and half-space do not create false misses:

| Rule | Detail |
|------|--------|
| Arabic kaf | `ك` (U+0643) → Persian `ک` (U+06A9) |
| Arabic yeh | `ي` (U+064A), `ى` (U+0649) → Persian `ی` (U+06CC) |
| ZWNJ / ZWJ | Strip `U+200C`, `U+200D` |
| Case | Unicode/SQL `lower` (ASCII brand names) |
| Whitespace | **Strip all** Unicode space so `می خواهم` matches `می‌خواهم` |
| Empty after normalize | Search clause omitted (ZWNJ-only / blank query) |

**Do not change one side without the other** — `pkg/searchtext` tests and this
doc are the contract.

### Matched fields (product list)

Free-text `search=` matches **any** of:

1. Product `title`
2. Product `description`
3. Brand `title` (EXISTS on `brands`)
4. Category `title` (EXISTS on `categories`)

Structured filters (`brand`, `category_id`, price, tags, …) stay separate query
params. **No new facet contract** in PH-030a — existing list filters are enough.

### Indexes (pg_trgm)

Migration enables `pg_trgm` and GIN indexes on:

- `rumera_search_normalize(products.title)`
- `rumera_search_normalize(brands.title)`
- `rumera_search_normalize(categories.title)`

These accelerate `ILIKE '%…%'` on normalized titles. Description is matched but
**not** trigram-indexed (text can be long; sequential scan acceptable at current
catalogue scale). Apply the migration on every environment before relying on
search in production.

### Behavior notes

- Empty `q` / empty after normalize → no free-text predicate; page shows
  empty/prompt state + category links on the FE.
- Results are the standard product list projection (cards reuse catalogue UI).
- No typo tolerance beyond substring; ranking is list sort only (`created_at`,
  `title`, `price`, …).
- Pagination/limit: search page uses `limit: 24` today.
- Literal `%` / `_` / `\` in the query remain literal (escaped).

### Meilisearch readiness (PH-030b) — **not** storefront authority

Live shopper discovery remains **Postgres ILIKE** (above). Meili is optional
infra for index quality + dual-path experiments until cutover criteria pass.

| Artifact | Role |
|----------|------|
| `MEILI_ENABLED` | Feature flag (default **false**) |
| `MEILI_HOST`, `MEILI_API_KEY`, `MEILI_INDEX_UID` | Connection (default index `products`) |
| `CRON_MEILI_REINDEX_SCHEDULE` | Full rebuild when client connected (default `0 30 4 * * *` UTC) |
| `pkg/meili` | HTTP client: health, ensure index/settings, delete-all, upsert, search, task wait |
| `models.MeiliProduct` | Flat document + `*_search` normalized fields |
| `product.ToMeiliProduct` / `DocumentsFromIndexRows` | Domain → document (uses `searchtext.Normalize`) |
| `product.ListForSearchIndex` | Postgres projection for full rebuild |
| `product.MeiliIndexer.FullReindex` | Ensure settings → wipe → batch upsert |
| `corn.MeiliReindexJob` | Cron wrapper (registered only if client non-nil) |
| Bootstrap | Fail-soft connect when enabled (warn + continue if down) |

**Document fields**

| Field group | Contents |
|-------------|----------|
| Identity / display | `id`, `title`, `code`, `slug`, `description`, `brand_title`, `category_title`, `tags`, `meta_tags` |
| Filters / sort | `is_active`, `brand_id`, `category_id`, `min_price`, `max_price`, `country_of_origin` |
| Search (normalized) | `title_search`, `description_search`, `brand_search`, `category_search` |

Searchable attributes prefer `*_search` then display text. **No stock fields** —
availability always from Postgres on any future cutover.

**Failure modes**

| Situation | Behaviour |
|-----------|-----------|
| `MEILI_ENABLED=false` | No client, no reindex cron; storefront unaffected |
| Enabled, Meili down at boot | Log warn; cron not registered; API serves ILIKE |
| Reindex error mid-job | Logged; process stays up; next schedule retries full rebuild |
| Empty catalogue | Index cleared + zero upserts (valid empty index) |

**Dual-path design (cutover only when quality proven)**

```
                    ┌── Postgres ILIKE (current authority) ──► ProductListItem
GET /products?search=┤
                    └── (future) Meili Search → product IDs
                              └── hydrate list projection + stock from Postgres
```

Cutover checklist (do **not** flip without evidence):

1. `MEILI_ENABLED=true` + healthy reindex job for ≥1 full catalogue cycle  
2. Side-by-side quality sample (Persian confusables, brand/category, zero-result rate)  
3. Hybrid or Meili-primary behind an explicit flag; **never** return Meili prices/stock as sole truth  
4. Incremental upsert/delete on product write (optional after full rebuild is trusted)  
5. FE continues `listProducts({ search })` — no browser→Meili calls  

Incremental write hooks and HTTP dual-path are **out of PH-030b** (readiness only).

---

## B. Search analytics (admin)

### Event capture

Storefront/analytics middleware records events into the **analytics** database
(`events` hypertable / table). Search-related type:

- `event_type = 'search_performed'`
- payload includes `query`, `results_count`, and related fields

Events are ingested asynchronously (buffered queue; drop-on-full). See main
[architecture.md](../architecture.md).

### Nightly aggregation job

**Job:** `internal/corn/search_job.go` → `SearchCronJob`  
**Service:** `SearchSummaryService` → analytics `search_summary` repo

```
Yesterday UTC day
  → SQL aggregate from events (search_performed)
  → per distinct query_text:
       search_count, unique users/sessions,
       avg results, zero-result count,
       top clicked products, common filters, conversions
  → FlushBatch into search_summary
```

This job is **not** a Meilisearch indexer. Naming is historical/analytics-
centric.

### Admin read APIs

Frontend `features/analytics/api.ts` (staff, BFF admin):

| Helper | Backend idea |
|--------|----------------|
| top search terms | `/admin/analytics/search/top-terms` |
| zero-result terms | `.../zero-result` |
| top converting | `.../top-converting` |

UI boards (e.g. `AnalyticsSearchTerms`) consume these for merchandising and SEO
content decisions.

---

## Decision guide

| Goal | Do this |
|------|---------|
| Fix “search finds nothing for Arabic-yeh Persian title” | Already: `rumera_search_normalize` + `pkg/searchtext` (PH-030a) |
| Add brand/category/description into free-text | Already on product list (PH-030a) |
| “What did users search yesterday?” | Analytics events + search_summary job + admin APIs |
| Enable typo-tolerant search | PH-030b: wire Meili + indexer; keep inventory truth in Postgres |
| Track new search UX | Emit `search_performed` with accurate `results_count` |
| Extend normalize rules | Change **both** SQL function and `pkg/searchtext`, add tests |

---

## Related tests

- `pkg/searchtext` — normalize + LIKE escape unit tests
- `internal/features/catalog/product/repository_test.go` — search clause fields, Persian query bind, empty-after-normalize, wildcard escape
- Integration (tag-gated): `tests/integration/product_test.go` — literal `%`/`_`/`\` search
- Frontend search is mostly compositional; catalogue presentation tests cover
  card honesty of results

---

## ADR note

**ILIKE until Meili** remains the product decision. PH-030a improves ILIKE
quality without forcing cutover. See Obsidian
`11 Decisions/ADR Search ILIKE until Meili.md`.
