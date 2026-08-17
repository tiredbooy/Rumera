---
tags:
  - frontend
  - design
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Design System

Candle-lit cellar tokens (`--gold`, `--wine`), RTL logical props, Vazirmatn / Markazi, `faNum` / `formatPrice`. Admin charts: gold `oklch(0.72 0.15 75)` / blue `oklch(0.62 0.16 250)` via `@/lib/charts`.

`components/ui/` keeps only imported primitives (PR-090i). Unused zero-import copies (`calendar`, `carousel`, `drawer`, `sidebar`, `tooltip`, leftover `chart` re-export, …) were deleted. Do not re-add a shadcn primitive until a feature imports it. Package.json leftover deps (`vaul`, `react-day-picker`, …) are out of this PR.

Related: [[Frontend App]] · [[PWA and Brand]] · [[Platform Layer]]

Bridge: `apps/frontend/docs/platform/design-system.md`

#frontend #design
