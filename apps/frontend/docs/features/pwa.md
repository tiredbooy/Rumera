# Rumera Progressive Web App (Task 061i)

## Goals

Ship a **production-ready, installable** mobile experience for the storefront:

| Capability | Implementation |
|------------|----------------|
| Installable | Web App Manifest + icons + `beforeinstallprompt` / iOS A2HS guide |
| Standalone UI | `display: standalone`, theme colors, safe-area padding |
| Offline | Network-first pages + precached `/offline` shell |
| Updates | New SW → update toast → `SKIP_WAITING` → reload |
| Privacy | **Never** cache `/api/*`, `/account`, `/admin`, `/checkout`, auth |
| Brand | Icons generated from canonical Rumera dark-field mark (061h) |

## Architecture

```
app/manifest.ts              → /manifest.webmanifest
app/icon.tsx                 → 512×512 app icon
app/apple-icon.tsx           → 180×180 Apple touch
public/sw.js                 → service worker (static, versioned caches)
lib/pwa/config.ts            → cache policy constants (tested)
lib/pwa/install.ts           → iOS / standalone detection
components/pwa/
  pwa-provider.tsx           → register SW + mount UI
  pwa-install-prompt.tsx     → install / A2HS sheet
  pwa-update-toast.tsx       → update available
app/(storefront)/offline/    → offline fallback page
```

### Service worker strategy

| Request class | Strategy |
|---------------|----------|
| `navigate` (HTML) | Network-first → page cache → `/offline` |
| `/_next/static/*`, fonts, js/css | Cache-first |
| `/logo/*` | Cache-first (precached) |
| `/api/*`, `/account/*`, `/admin/*`, `/checkout/*`, auth routes | **Passthrough — never cache** |
| Cross-origin (API media host) | **Never cache** in SW |

Cache names are versioned (`rumera-pwa-v1-*`). Activating a new version deletes old caches.

### Install UX

1. **Chromium / Android / desktop** — capture `beforeinstallprompt`, show bottom sheet with «نصب اپ».
2. **iOS Safari** — no install event; after ~2.8s show Share → Add to Home Screen steps.
3. Dismiss persisted in `localStorage` (`rumera:pwa-install-dismissed`).

### Runtime enablement

| Environment | SW registered? |
|-------------|----------------|
| `NODE_ENV=production` | Yes (unless `NEXT_PUBLIC_PWA=0`) |
| Development | Only if `NEXT_PUBLIC_PWA=1` |

## Local verification

```bash
# Production-like
cd apps/frontend
NEXT_PUBLIC_PWA=1 npm run build && npm start
# Open Chrome DevTools → Application → Manifest / Service Workers
# Lighthouse → PWA category
```

Unit tests:

```bash
npx vitest run lib/pwa/
```

## iOS checklist

- [x] `appleWebApp.capable` + status bar translucent
- [x] `apple-icon` 180×180
- [x] `viewport-fit=cover` + safe-area on fixed UI
- [x] Manual A2HS guidance (no install prompt API)
- [x] RTL manifest (`dir: rtl`, `lang: fa`)

## What we deliberately do **not** do

- Cache cart/checkout/account HTML or JSON
- Cache POST/PUT/PATCH/DELETE
- Background sync of payments
- Opaque cross-origin media in the SW cache

## Follow-ups

- Add screenshot entries to the manifest when marketing assets exist.
- Optional push notifications belong with the Kafka notification worker (061j), not this SW.
