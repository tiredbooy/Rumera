---
tags:
  - frontend
  - hub
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Frontend App

Next.js 16 storefront + admin (React 19, Tailwind 4, Auth.js, TanStack Query).

## Surfaces

| Area | Notes |
|------|--------|
| Storefront | Public catalogue, recipes, journal, cart, checkout |
| Account | [[Account FE]] |
| Admin | [[Admin Console]] |
| BFF | [[BFF Proxies]] |

## Structure

- Thin routes: `app/**/page.tsx`
- Domains: `features/*` → [[Frontend Domain Map]]
- Infra: `lib/*` → [[Platform Layer]]

Related: [[Frontend Architecture]] · [[Design System]] · [[PWA and Brand]] · [[System Atlas]]

Bridge: `apps/frontend/docs/README.md`

#frontend #hub
