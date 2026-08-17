---
tags: [journey, content, journal]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Read journal

## Actor

Shopper | Staff

## Happy path

1. Staff create or patch a journal post with `status=published` and a future `published_at` → [[Blog Backend]]
2. Admin list/detail still return the row (preview, edit, featured)
3. Shopper `GET /blogs` / `GET /blogs/:slug` omit it until `published_at` (null or `<= now`)
4. After the stamp, list cards and slug detail appear; a successful slug fetch records a read

## Failure branches

- Draft / archived / future schedule → public `404` (same as missing slug)
- Admin still sees the post; no storefront leak

## Domains touched

- [[Recipes and Journal]]
- [[Term journal]]
- [[Content and SEO]]

## Related

[[Journeys MOC]] · [[Blog Backend]] · [[Surface Storefront]]

#journey
