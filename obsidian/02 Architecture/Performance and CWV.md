---
tags: [architecture, frontend]
aliases:
  - Core Web Vitals
  - CWV
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Performance and CWV

## Intentional choices already in the stack

- Public catalogue as [[Term RSC]] where possible
- Image policy via [[Media and Cache FE]] / transforms (width, format)
- `optimizePackageImports` for heavy icon/motion libs (Next config)
- Cache tags + short revalidate for availability-sensitive lists
- Soft-fail home sections so build doesn’t hard-crash offline API
- PWA caches static assets carefully — not API/media cross-origin

## Not formally budgeted (yet)

No locked LCP/INP/CLS numeric SLOs in vault. When you set them, record here + link lab runs.

## Related

[[Frontend Architecture]] · [[Media Pipeline]] · [[PWA and Brand]] · [[Hero and Home]] · [[Known gaps]]

#architecture
