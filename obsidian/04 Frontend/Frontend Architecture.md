---
tags:
  - frontend
  - architecture
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Frontend Architecture

- Route groups: `(storefront)` `(auth)` `(account)` — no URL segment
- `app/admin/` — real `/admin` segment
- Server Components by default; `"use client"` low in tree
- `params` / `searchParams` are **async** (Next 16)
- No Sentry SDK — `global-error.tsx` is `console.error` only (PR-090d)

Related: [[Frontend App]] · [[Request Paths]] · [[BFF Proxies]] · [[Platform Layer]]

Bridge: `apps/frontend/docs/platform/architecture.md` · `AGENTS.md`

#frontend #architecture
