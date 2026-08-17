# Findings — `fe-storefront`

**Workstream:** `production-readiness-20260816`  
**Agent:** `fe-storefront`  
**Lane:** `app/(storefront)/**` + home, products list/PDP, categories, brands, tags, search, recipes, journal, about, faq, hero, navigation, age-gate. Product cards **except** PR-004 add-to-cart 500 / variant id.  
**Date:** 2026-08-16  
**Method:** current source only. No app edits. Historical `docs/IMPROVEMENT-OPPORTUNITIES.md` treated as a hint list and re-verified.

Already claimed (not re-proposed): PR-001a–c, PR-002a, PR-003a–m, PR-004a–d, PR-005a–c, PR-010a–g, PR-011a–e.

**Wave-2 ID map (avoid collisions):**
- `be-catalog-content` → PR-020–027 (BE)
- `fe-commerce-account` → PR-030+
- `fe-platform-quality` → PR-040–048 (owns `robots.ts` `/checkout` + sitemap `/brands`)
- **this lane → PR-050–054**

---

## Re-verify (IMPROVEMENT hints)

### 6.1 Product-card wishlist heart — **mostly fixed**

Hint said `catalog/product-card.tsx` has no heart.

**Now:** `features/catalog/products/components/product-card-actions.tsx` L100–127 renders a 44px RTL `end-3 top-3` heart with `useWishlist` / `useAddWishlistItem` / `useRemoveWishlistItem`, login redirect, and `interaction_type: "wishlist"`.

**Residual:** heart only when `purchasableVariantId` (`isQuickPurchasable`). Multi-option cards have no heart. Wishlist is variant-scoped. PDP still wishlists the selected variant. See **PR-054a**.

### 6.11 Home mock featured bottles — **fixed**

Home `CatalogSection` uses live `listProducts`. `lib/products.ts` is helpers + unused mock *type*. Home Organization + WebSite JSON-LD restored (PR-080k) — live `siteConfig` only, no mock ItemList.

**Residual:** ~~`getFeaturedBrands()` fallback to 16 hardcoded Western liquor names~~ — **PR-080i**: empty → `[]`; API/network errors propagate.

### 5.20 Multiple home `<h1>` — **fixed**

One `sr-only` `<h1>` in `home-view.tsx` L62. Hero titles are `<h2>` (`hero-carousel.tsx` L319).

### 6.12 `/checkout` indexable — **partial**

Page `noindexMetadata` on checkout layout: **done**. Skip-to-content + 512 manifest icons: **done**. `robots.ts` still allows `/checkout` — **`fe-platform-quality` PR-042a**.

### 6.18 Slug fallback — **fixed**

`getProductBySlug` → exact `GET /products/slug/:slug`; typed 404 → `null`. `be-catalog-content` confirmed BE exact slug + `is_active`. Empty slugs already render «بدون صفحهٔ عمومی».

---

## Answers to other agents

**`be-catalog-content`:** No `GET /search`. Path stays `/search?q=` → `listProducts({ search })`. Storefront does **not** send `min_price`/`max_price`. Empty-slug auto-slug is their PR-022; cards will keep non-links.

**`fe-platform-quality`:** Ack. You own robots `/checkout` + sitemap `/brands`. I keep page-level storefront JSON-LD / products noindex / journal publisher logo.

**`fe-commerce-account`:** Ack PR-030+. Purchase signal only after paid. For-You envelope is `{data: RecommendationItem[]}` + `product_id`.

---

## What is already healthy

- Storefront error / not-found / loading shells; nested 404s.
- Journal/recipes/category/tag metadata noindex filtered URLs.
- Brand index distinguishes load error vs empty.
- Age gate blocking dialog + localStorage.
- Skip link, single home h1, 44px card targets, `aria-pressed` heart.
- BFF `me` allow-listed. `add_to_cart` / `view` / `wishlist` / `search_click` / `recipe_view` recorded.
- Recipe add-all uses bulk cart + real counts.
- BE product search is multi-field (title, description, brand, category).

---

## Live findings

### P0 — Storefront chrome ignores `GET /settings`

`docs/api/site-settings.md`: hot read on every storefront page. FE `getPublicSiteSettings()` exists. **Only checkout gift** calls it.

| Group | Storefront instead |
| --- | --- |
| `maintenance` | Ignored; shoppers still buy. |
| `shipping.freeThreshold` / `note` | Promo bar is settings-backed (PR-080a). **PR-080h:** FAQ no longer hardcodes ۵٬۰۰۰٬۰۰۰. |
| `contact.*` | `/contact` is a real route (PR-080c). FAQ support CTA links there. |
| `social.*` | **PR-080a:** footer uses `GET /settings`; empty / `#` omitted. PR-080h did not rewrite footer. |
| `store` / `seo` | `lib/site.ts` constants. |
| Newsletter | **PR-080g:** honest «به‌زودی» stubs. No email form; no first-order free-ship promise. |

### P0 — `getCategoryTree()` can 500 the entire storefront

`app/(storefront)/layout.tsx` L17 awaits `getCategoryTree()` with no settle (`cache: "no-store"`). Tree 5xx takes down header + every public page.

Category detail **throws** if the slug category is missing from the tree (`category-detail-view.tsx` L52–55; test treats it as operational inconsistency). Shoppers get a generic error, not 404.

### P1 — Search treats API failure as zero results

`search-view.tsx` `settleProducts` swallows errors. Copy still says search is **title-only** (false). Product list throws to the error boundary but empty Placeholder conflates “no products” vs outage.

### P1 — Home empty/misleading surfaces

- ~~`FALLBACK_BRANDS` fake liquor names~~ — **PR-080i** (empty `[]` / throw; no invented names).
- “منتخب / تازه رسیده” is `listProducts({limit:8})`, not featured.
- `CategoryGrid` renders an empty heading when featured categories are `[]`.
- Hero file fallbacks point at missing `/images/hero/slide-*.jpg` (SmartImage placeholders).

### P1 — Dead / mock marketing

- About invented stats (+۱٬۲۰۰ محصول, +۸۰ برند, ۴٫۹, ۳۲ استان). **PR-080h:** qualitative highlights only.
- FAQ claims a returns page that does not exist. **PR-080h:** support via `/contact`; no guest checkout or invented free-ship.
- Age gate cites terms/privacy with no URLs. **PR-080h:** left as prose — do not invent `/terms` or `/privacy`.
- `productLd` / `itemListLd` still model mock `lib/products.Product`.

### P1 — Storefront SEO leftovers

- Home has **no** Organization / WebSite JSON-LD (only about mounts org).
- `/products` metadata is static; search/brand/page variants stay indexable. · **DONE PR-080l**
- Journal `BlogPosting.publisher` has no `logo` (hint 6.17). · **DONE PR-080m**

### P2 — Catalog UX

- No card heart without `purchasable_variant_id`.
- Tag chips not linked to `/tags/:id`.
- Header search `lg+` only.

---

## Proposed tasks (PR-050+)

| ID | Title | Owner | Pri | Size |
| --- | --- | --- | --- | --- |
| **PR-050a** | Wire `GET /settings` into storefront chrome | fe | **P0** | M |
| **PR-050b** | Honor `maintenance.enabled` on the storefront | fe | **P0** | S |
| **PR-050c** | Replace `/contact` 404 with settings-backed contact | fe | **P0** | S |
| **PR-051a** | Settle `getCategoryTree` in the storefront layout | fe | **P0** | S |
| **PR-051b** | Category missing from tree → `notFound()`, not throw | fe | **P1** | S |
| **PR-051c** | Search/list distinguish API error vs zero hits | fe | **P1** | S |
| **PR-052a** | Newsletter forms are no-ops | fe | **P1** | S |
| **PR-052b** | Stop invented about/FAQ claims and `#` socials | fe | **P1** | S | **→ PR-080h DONE** |
| **PR-052c** | Drop home `FALLBACK_BRANDS` fake names | fe | **P1** | S | → **PR-080i** |
| **PR-052d** | Hide empty home category grid | fe | **P2** | S |
| **PR-053a** | Restore live home Organization + WebSite JSON-LD | fe | **P1** | S | **DONE as PR-080k** |
| **PR-053b** | `/products` noindex filter/search/page variants | fe | **P1** | S | **DONE as PR-080l** |
| **PR-053c** | Journal `BlogPosting.publisher.logo` | fe | **P2** | S | **DONE as PR-080m** |
| **PR-054a** | Card wishlist for multi-option products | fe | **P2** | S |
| **PR-054b** | Link tag chips to `/tags/:id` | fe | **P2** | S |
| **PR-054c** | Fix search copy (not title-only) | fe | **P2** | S |

**Hand-off:** robots `/checkout` + sitemap `/brands` → platform PR-042a/b. Checkout/purchase → commerce PR-030+. Settings lock / auto-slug / search analytics → catalog-content PR-021–023. Add-to-cart 500 → PR-004a.

**Order:** PR-051a → PR-050a/b/c → PR-051b/c → PR-052a–c → PR-053a/b → rest.

---

## Evidence (absolute)

`/home/tehranspeaker/Videos/Rumera/apps/frontend/app/(storefront)/layout.tsx`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/app/robots.ts`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/home/components/home-view.tsx`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/catalog/brands/api.ts`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/catalog/categories/components/category-detail-view.tsx`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/catalog/products/api/public.ts`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/catalog/products/components/product-card-actions.tsx`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/storefront/search/components/search-view.tsx`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/storefront/navigation/config.ts`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/components/site-footer.tsx`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/features/settings/api/server.ts`  
`/home/tehranspeaker/Videos/Rumera/apps/frontend/lib/seo/jsonld.ts`  
`/home/tehranspeaker/Videos/Rumera/apps/backend/docs/api/site-settings.md`  
`/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/catalog/product/repository.go`

No application code changed.
