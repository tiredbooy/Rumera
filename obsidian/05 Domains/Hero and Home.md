---
tags: [domain, content]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Hero and Home

BE package: [[Hero Slides Backend]] (`internal/features/hero`).

Homepage composition: hero carousel, perks, brands, categories, catalogue strip, recommendation rails, story, newsletter.

- Soft-fail sections when API offline (SSG resilience) — **not** brands
- Hero CMS: admin hero-slides · [[Term hero slide]]
- Home brands (`getFeaturedBrands`) are live `GET /brands` only (PR-080i). Empty catalogue → `[]`. API failure **throws** (home `error.tsx`). Do not invent liquor names.
- Newsletter band is honest «به‌زودی» — no email form until a subscribe API exists (PR-080g). Same stub in the footer. · [[Surface Storefront]]
- `CategoryGrid` hides when featured categories are empty; do not invent categories (PR-080j).
- Home JSON-LD is Organization + WebSite from live `siteConfig` (`HomeStructuredData`). No mock product ItemList (PR-080k). · [[Content and SEO]] · [[Surface Machine SEO]]

Related: [[Content and SEO]] · [[Catalogue]] · [[Recommendations]] · [[Media and Cache FE]] · [[Surface Storefront]]

#domain
