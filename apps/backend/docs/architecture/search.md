# Search architecture

**Who this is for:** engineers changing storefront search, product list
`search=` filters, or admin “top search terms” analytics.

**Frontend UX:** [search.md](../../../frontend/docs/features/search.md)  
**Data stores:** [data-stores.md](./data-stores.md)

---

## Two different “search” systems

Rumera has **two** search-related pipelines. Do not conflate them.

| System | Purpose | Storage | Hot path |
|--------|---------|---------|----------|
| **A. Product discovery** | Shoppers find bottles | Main Postgres (`ILIKE` today) | `GET /products?search=` |
| **B. Search analytics** | Admin sees what people typed | Analytics DB (`search_summary`) | Cron + admin analytics APIs |

Meilisearch appears in **config and types** as a planned full-text index, but is
**not wired into the running API bootstrap** today (client construction is
commented out). Treat Meili as **future/derived**, not current query authority.

---

## A. Product discovery (current)

### Request path

```
Header search / /search?q=…
  → listProducts({ search: query })   # frontend public API
  → GET /api/v1/products?search=…&limit=…
  → product repository
  → WHERE p.title ILIKE '%' || escaped(query) || '%'
```

**Code:**

- Frontend: `features/storefront/search/components/search-view.tsx`
- Frontend header: `features/storefront/navigation/components/header-search.tsx`
- Backend filter: `internal/repositories/product_repo.go` (`f.Search`)
- Escape helper: `escapeLikePattern` (prevents `%` / `_` injection in LIKE)

Same `search` query param pattern is reused for admin/list endpoints on brands,
categories, recipes, blogs, coupons, shipping, inventory, users, etc. — each
with its own column set — but the **customer storefront search page** is product
title search via the public products list.

### Behavior notes

- Empty `q` → no product query; page shows empty/prompt state + category links.
- Results are the standard product list projection (cards reuse catalogue UI).
- No typo tolerance, ranking, or faceted search beyond what the products filter
  API already supports (brand, category, sort, …) when callers pass those params.
- Pagination/limit: search page uses `limit: 24` today.

### Meilisearch (prepared, not active)

| Artifact | Role |
|----------|------|
| `MEILI_HOST`, `MEILI_API_KEY` | Env |
| `models.MeiliProduct` | Flat document shape (id, title, tags, min/max price, …) |
| `mappers.ToMeiliProduct` | Domain → document |
| `bootstrap/app.go` | `// meili, err := search.NewMeilisearch(...)` commented |

**When enabling Meili later:**

1. Uncomment/wire client in bootstrap.
2. Add an indexer job (product create/update/delete + full rebuild).
3. Point storefront search at Meili (or hybrid) **without** inventing prices —
   still join availability from main DB or denormalize carefully.
4. Document the cutover here and in the frontend search guide.

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
| Fix “search finds nothing for Persian title” | Improve Postgres `ILIKE` / normalization; tests in `product_repo_test` |
| Add brand/category into free-text | Extend SQL `WHERE` (or enable Meili with those fields) |
| “What did users search yesterday?” | Analytics events + search_summary job + admin APIs |
| Enable typo-tolerant search | Wire Meili + indexer; keep inventory truth in Postgres |
| Track new search UX | Emit `search_performed` with accurate `results_count` |

---

## Related tests

- `internal/repositories/product_repo_test.go` — search clause presence / filters
- Analytics contract tests under `internal/models` / handlers as applicable
- Frontend search is mostly compositional; catalogue presentation tests cover
  card honesty of results
