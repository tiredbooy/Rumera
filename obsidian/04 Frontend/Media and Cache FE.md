---
tags:
  - frontend
  - media
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Media and Cache FE

- Single resolver: `lib/media/resolve-media-url.ts`
- Store origin-independent paths from API
- Cache tags + `admin-revalidation` after CMS writes
- SW must not cache cross-origin media → [[PWA and Brand]]
- `next.config.ts` `images.remotePatterns` = `NEXT_PUBLIC_MEDIA_BASE_URL` then `NEXT_PUBLIC_API_URL` host (no `**`; empty = same-origin)

Related: [[Media Pipeline]] · [[Catalogue]] · [[Content and SEO]]

Bridge: `apps/frontend/docs/features/media-and-cache.md`

#frontend #media
