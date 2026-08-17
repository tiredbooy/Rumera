---
tags:
  - domain
  - content
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Recipes and Journal

Recipes BE: [[Recipes Backend]] (`internal/features/recipes`).  
Journal BE: [[Blog Backend]] (`internal/features/blog`).  
Hero: [[Hero Slides Backend]] (`internal/features/hero`).

Editorial content + commerce hooks.

- Recipes: ingredients can link variants → shoppable journey
- Recipe slugs are globally unique. Concurrent create/update of the same slug
  is **409 CONFLICT** (advisory lock + unique-index map). Omitted slug is
  auto-suffixed (`old-fashioned-2`). Same pattern as journal (PR-070f).
- Recipes: public list/detail/sitemap/cross-sell hide `published` rows whose
  `published_at` is still in the future; NULL stamp stays live (PR-070g).
- Journal: blog posts (backend “blog”). Public storefront hides `published` posts whose `published_at` is still in the future; admin CMS still lists them ([[Journey Read journal]], PR-070g)
- Journal `BlogPosting` publisher logo is the real `siteConfig.logo` `ImageObject` (PR-080m)
- Hero slides: homepage CMS

FE: [[Content and SEO]] · recipe-commerce doc  
BE: feature slices under `internal/features/{recipes,blog,hero}`  
Media: [[Media Pipeline]]

Related: [[Catalogue]] · [[Search]]

#domain #content
