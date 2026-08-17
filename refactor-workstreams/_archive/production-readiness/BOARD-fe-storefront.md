### fe-storefront mid — 2026-08-16T16:50:00Z

Re-verify (current code):

| Hint | Verdict |
| --- | --- |
| 6.1 card wishlist heart | **Mostly done.** Heart only when `purchasable_variant_id`. |
| 6.11 mock featured bottles | **Fixed.** Residual: `FALLBACK_BRANDS`. |
| 5.20 multiple home `<h1>` | **Fixed.** |
| 6.12 checkout robots | **Partial.** Page noindex done. `robots.ts` → platform **PR-042a**. |
| 6.18 slug fallback | **Fixed.** Exact slug GET. Catalog-content agrees. |

**Ack collisions:** catalog-content PR-020–027; commerce PR-030+; platform PR-040–048. This lane uses **PR-050–054**.

**Ack `be-catalog-content`:** no `GET /search`; stay on `GET /products?search=`. Storefront does not send price facets. Empty-slug cards stay unlinked.

**Ack `fe-platform-quality`:** you own robots `/checkout` + sitemap `/brands`.

**To `be-catalog-content`:** confirm `maintenance.enabled` is hard-block vs banner. Confirm tree-vs-slug mismatch is possible (FE currently throws).

**To `be-engagement`:** wishlist variant-only — intended for multi-option cards? Reviews public envelopes stay `{results,pagination}` + summary?

No application code changed.

---

### fe-storefront done — 2026-08-16T16:55:00Z

Report: `refactor-workstreams/production-readiness/findings-fe-storefront.md`

**Proposed tasks (PR-050–054):**

- **PR-050a** — Wire `GET /settings` into storefront chrome
- **PR-050b** — Honor `maintenance.enabled`
- **PR-050c** — Replace `/contact` 404 with settings-backed contact
- **PR-051a** — Settle `getCategoryTree` in storefront layout
- **PR-051b** — Category missing from tree → 404
- **PR-051c** — Search/list distinguish error vs zero
- **PR-052a** — Newsletter forms are no-ops
- **PR-052b** — Stop invented about/FAQ claims and `#` socials
- **PR-052c** — Drop home `FALLBACK_BRANDS`
- **PR-052d** — Hide empty home category grid
- **PR-053a** — Restore home Organization + WebSite JSON-LD
- **PR-053b** — `/products` noindex filter/search/page variants
- **PR-053c** — Journal `BlogPosting.publisher.logo`
- **PR-054a** — Card wishlist for multi-option products
- **PR-054b** — Link tag chips to `/tags/:id`
- **PR-054c** — Fix search copy (not title-only)

No application code changed.
