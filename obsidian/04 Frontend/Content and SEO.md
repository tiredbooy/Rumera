---
tags:
  - frontend
  - seo
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Content and SEO

Home, hero, journal, recipes surfaces + sitemap, robots, llms.txt, JSON-LD, OG.

`/products` `generateMetadata` (PR-080l): index only the clean catalogue.
Search, brand, sort, `page>1`, and malformed query variants are
`noindex, nofollow` with canonical `/products`. Journal/recipes still
self-canonicalize clean paginated pages.

Journal `BlogPosting.publisher.logo` is an `ImageObject` whose `url` is the
real site mark from `lib/site.ts` (`siteConfig.logo` / `organizationLd`), not
an invented brand (PR-080m).

Home Organization + WebSite JSON-LD is live again (PR-080k): `HomeView`
mounts `HomeStructuredData` (`organizationLd()` + `websiteLd()` from
`siteConfig`). No mock product ItemList. About still mounts Organization.

About / FAQ (PR-080h): no invented catalogue stats, ratings, or province counts. FAQ must not claim a `/returns` page — damage/mismatch goes to `/contact`. Do not invent `/terms` or `/privacy` URLs on the age gate. Footer socials stay settings-backed (omit empty / `#`).

Related: [[Recipes and Journal]] · [[Media and Cache FE]] · [[PWA and Brand]] · [[Storefront Commerce FE]] · [[Surface Machine SEO]] · [[Term journal]]

Bridge: `apps/frontend/docs/features/content-and-seo.md`

#frontend #seo
