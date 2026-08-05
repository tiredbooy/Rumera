---
tags:
  - frontend
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Platform Layer

`lib/` infrastructure (not product domains):

| Path | Role |
|------|------|
| `lib/api/*` | public / server / store clients |
| `lib/auth/*` | Auth.js + guards → [[Auth and Sessions]] |
| `lib/rbac/*` | [[RBAC]] |
| `lib/media/*` | [[Media and Cache FE]] |
| `lib/seo/*` | [[Content and SEO]] |
| `lib/cache-tags` + revalidation | [[Media and Cache FE]] |
| `lib/pwa` · `lib/brand` | [[PWA and Brand]] |
| `lib/site` | SEO defaults |

Related: [[Frontend Architecture]] · [[BFF Proxies]] · [[Design System]]

Bridge: `apps/frontend/docs/platform/*`

#frontend
