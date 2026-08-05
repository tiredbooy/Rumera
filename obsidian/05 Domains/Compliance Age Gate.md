---
tags: [domain, compliance]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Compliance Age Gate

## What it is

Full-screen **18+** verification dialog on first storefront visit for alcohol retail. Sets tone and keeps underage friction high.

## Behavior (frontend)

- Component: `features/compliance/components/age-gate.tsx`
- Mounted from storefront layout chrome
- Persistence: `localStorage` key `rumera:age-verified` = `"true"`
- Server snapshot assumes verified (`true`) to avoid SSR flash; client re-reads and shows gate if missing
- Body scroll locked while open
- Confirm writes storage + dispatches `rumera:age-verified` custom event
- Dialog has no close button — must confirm (decline path if implemented: leave site)

## What it is **not**

- Not server-side legal enforcement
- Not tied to [[Auth and Sessions]] identity
- Not a substitute for payment/shipping age checks if law requires more later

## A11y

Must remain keyboard operable (dialog focus trap via shared Dialog component). Automated browser coverage is Task 062 territory.

## Related

[[Surface Storefront]] · [[Frontend App]] · [[RTL and Persian UX]] · [[Hero and Home]]

#domain #compliance
