# Content surfaces and SEO

**Who this is for:** anyone working on the homepage, recipes, journal, hero
CMS, or machine-readable SEO surfaces.

**Backend APIs:**
[recipes](../../../backend/docs/api/recipes.md) ·
[blog](../../../backend/docs/api/blog.md) ·
[hero-slides](../../../backend/docs/api/hero-slides.md)

---

## Homepage

| Piece | Code |
|-------|------|
| Thin route | `app/(storefront)/page.tsx` → `HomeView` |
| Composition | `features/home/components/home-view.tsx` |
| Hero | `features/hero-slides` + `HeroCarousel` |
| Categories / brands / catalogue strip | catalog domains + `CatalogSection` |
| Rails | recommendations + recently viewed |

`HomeView` loads surfaces in parallel and **soft-fails** catalogue/category
sections if the API is offline so `next build` and partial outages do not take
down the entire page. Hero/brands/trending already ship fallbacks inside their
API modules. `CategoryGrid` returns nothing when featured categories are `[]`
— no empty heading and no invented categories (PR-080j).

Home emits Organization + WebSite JSON-LD (`HomeStructuredData` →
`organizationLd()` / `websiteLd()` from live `siteConfig`). No mock product
ItemList (PR-080k).

---

## Recipes

| Concern | Location |
|---------|----------|
| Public API | `features/recipes/api/server.ts` |
| List / detail UI | `recipe-list-view`, `recipe-detail-view` |
| Cards | `recipe-card.tsx` |
| Commerce link | `commerce.ts`, `recipe-ingredient-list.tsx`, `shoppable-product-card.tsx` |
| Docs | [recipe-commerce.md](./recipe-commerce.md) |

Recipes are editorial content **plus** optional `product_variant_id` links.
Never invent stock; use shoppable product payloads from the API.

Cache tag: `RECIPE_CACHE_TAG`. Revalidate on admin recipe writes.

---

## Journal (blog)

| Concern | Location |
|---------|----------|
| Public API | `features/journal/api/server.ts` |
| List / detail | `journal-list` / `journal-detail-view` |
| Cards / product embeds | `journal-card`, `article-product-card` |
| Helpers | `lib` journal helpers if present |

Backend resource name is **blog**; frontend product language is **journal**.
That naming split is intentional — map carefully at the API boundary.

Cache tag: `JOURNAL_CACHE_TAG`.

---

## Hero slides

| Concern | Location |
|---------|----------|
| Public list | `features/hero-slides/api/server.ts` |
| Admin board | `features/admin/hero-slides` |
| Publication rules | `publication-status` helpers |

Public list falls back to static slides if the API fails (homepage resilience).

---

## SEO system

### Single source of brand copy

`lib/site.ts` — name, title, description, URL, locale, default OG path, keywords.

### Metadata

`lib/seo/metadata.ts` — `buildMetadata({ title, description, path, images, … })`
used by list/detail routes.

`/products` uses `generateMetadata` (PR-080l). The clean catalogue is
indexable at `/products`. Search (`search=`), brand (`brand=`), non-default
sort, `page>1`, and malformed query variants are `noindex, nofollow` and
keep the canonical on clean `/products`. Journal/recipes still
self-canonicalize clean paginated pages; the product list does not.

### JSON-LD

`lib/seo/jsonld.ts` — Product, Recipe, Article, list helpers. Image URLs go
through `resolveMediaUrl` so structured data matches visible media.

Journal detail (`journalArticleLd` → `BlogPosting`) sets `publisher` to the
site `Organization` with a `logo` `ImageObject`. The logo URL is
`absoluteUrl(siteConfig.logo)` — the same shipped mark as `organizationLd`
(`lib/site.ts` → `brandPaths.iconPng`). Do not invent a second brand mark
(PR-080m). Home (`HomeView` → `HomeStructuredData`) emits Organization +
WebSite (`SearchAction`) from the same `siteConfig` — not a mock product
ItemList (PR-080k). About still mounts Organization on `/about`.

### Machine surfaces

| URL | File | Role |
|-----|------|------|
| `/sitemap.xml` | `app/sitemap.ts` | Static + dynamic URLs; soft-fails dynamic lists if API down |
| `/robots.txt` | `app/robots.ts` | Crawl rules |
| `/llms.txt` | `app/llms.txt/route.ts` | GEO / LLM-oriented site map |
| `/opengraph-image` | `app/opengraph-image.tsx` | Default social card |
| `/manifest.webmanifest` | `app/manifest.ts` | PWA (see [pwa.md](./pwa.md)) |
| `icon` / `apple-icon` | generated routes | App icons from brand marks |

### Open Graph / Satori note

`next/og` (Satori) needs **vendored TTF** bytes — it cannot use `next/font`
Google loaders. Rumera ships Vazirmatn under `public/fonts/` and loads them via
`lib/og/fonts.ts` into `app/opengraph-image.tsx` (+ `twitter-image.tsx`).

- Glyph shaping for Persian works with Vazirmatn.
- Multi-clause CSS `direction: rtl` reordering is incomplete in Satori, so the
  card uses **short right-aligned Persian lines** (wordmark, category triad,
  tagline). Full Persian title/description stay in HTML `<meta>` / `siteConfig`
  for crawlers.
- Do not delete `public/fonts/*.ttf` — social previews depend on them.

---

## Admin content writes → public freshness

Hero, recipe, journal, and product media writes should go through the admin BFF
and trigger `getAdminRevalidationPlan` so tagged RSC caches expire. If a new
content type is added, extend both cache tags and revalidation plans (see
[media-and-cache.md](./media-and-cache.md)).
