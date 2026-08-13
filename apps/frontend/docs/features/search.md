# Storefront search (frontend)

**Who this is for:** UI engineers changing the search box, `/search` page, or
how results are rendered.

**Backend truth:** [search architecture](../../../backend/docs/architecture/search.md)

---

## User journey

```
HeaderSearch (client)
  → router.push(`/search?q=…`)
        │
        ▼
app/(storefront)/search/page.tsx  → SearchView (RSC)
  → listProducts({ search: q, limit: 24 })
  → ProductCard grid  or  empty state
```

| Piece | Path |
|-------|------|
| Thin route | `app/(storefront)/search/page.tsx` |
| View | `features/storefront/search/components/search-view.tsx` |
| Header field | `features/storefront/navigation/components/header-search.tsx` |
| Product API | `features/catalog/products/api/public.ts` → `search` query param |

### Header vs page form

- **Header:** controlled client input; navigates on submit (inline or mobile
  drawer variant).
- **Page form:** progressive-enhancement `GET` form `action="/search"` so the
  page works without the header JS island.

Both use `role="search"` and accessible labels (Persian).

---

## What the backend does (short)

Today search is **Postgres `ILIKE` with Persian-aware normalize** (PH-030a), not
Meilisearch. Free-text matches product **title, description, brand, and category**
after normalizing Arabic/Persian confusables (`ك/ي` → `ک/ی`), stripping ZWNJ, and
collapsing whitespace. Ranking and typo-tolerance remain limited.

**PH-030b** prepared a Meili index client + full reindex cron behind
`MEILI_ENABLED` (default off). Storefront is **not** cut over; dual-path design
lives in backend `architecture/search.md`. Full pipeline and analytics: backend
search doc.

Do **not** call Meili from the browser. Do **not** invent a second client-side
filter over a full catalogue download.

---

## Result rendering

- Reuse `ProductCard` + `PRODUCT_CARD_GRID_CLASS` so search results match home
  and catalogue truthfulness (price, stock, links).
- Empty query: do not fetch products; show prompt + optional category directory.
- Non-empty with zero hits: dedicated empty state (not a hard error).

---

## Analytics (optional product work)

If you need admin “top terms,” ensure the app still emits search events the
analytics middleware can see (backend event type `search_performed`). Frontend
admin charts read aggregated data via `features/analytics/api.ts` — they do not
query Meili.

---

## Accessibility checklist

- Visible label / `aria-label` on the search field
- Submit control has an accessible name
- Results region announces count in Persian numerals (`faNum`)
- Keyboard: focus field, type, Enter submits

Automated browser coverage is expected under Task 062 (Playwright).

---

## When you change search

1. Keep URL `?q=` as the source of truth (shareable, back-button friendly).
2. Preserve BFF/public split — search page is public RSC.
3. If you add filters on `/search`, encode them in the query string and pass
   through `listProducts` / list-routing helpers.
4. Update backend search doc if the query engine changes (e.g. Meili cutover).
