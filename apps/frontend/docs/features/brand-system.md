# Rumera brand system (Task 061h)

## Purpose

One source of truth for the Rumera monogram and wordmark across:

- Storefront header / footer / mobile drawer
- Auth shell, age gate, 403 page
- Account + admin dashboard chrome
- Metadata icons, Apple touch, Open Graph, JSON-LD logo

## Architecture

```
public/logo/*          ← shipped artwork (do not rename casually)
lib/brand.ts           ← paths, dimensions, alt copy, mark sizes
components/brand/
  rumera-brand-mark.tsx  ← only UI entry for the logo
lib/site.ts            ← site name + logo metadata pointers
app/icon.tsx           ← generated 512 tab/PWA icon from dark mark
app/apple-icon.tsx     ← 180 Apple touch from dark mark
app/opengraph-image.tsx  ← Persian OG (Vazirmatn from public/fonts)
app/twitter-image.tsx    ← re-exports OG art
public/fonts/Vazirmatn-*.ttf  ← Satori-only (not next/font)
app/manifest.ts        ← icon entries for install
```

### Asset selection (audit)

| Asset | Size | Use |
|-------|------|-----|
| `Rumera-Light.svg/png` | 446×377 RGBA | Light surfaces (black monogram, transparent) |
| `Rumra-Dark.svg/png` | 435×388 RGBA | Dark surfaces & icons (dark-field badge; **filename typo retained**) |

## Component API

`RumeraBrandMark` — see JSDoc on the component.

- **Mobile-first**: linked marks use `min-h-11 min-w-11` touch targets.
- **Responsive**: size tokens `xs`→`xl`; wordmark scales with `sm:` where needed.
- **A11y**: sole identity → named; adjacent wordmark → `decorative`.
- **No stretch**: fixed aspect box + `object-contain`.

## Adding a new surface

1. Import `RumeraBrandMark` (not Lucide `Wine`, not raw `/logo` paths).
2. Choose `variant` + `tone` for the background.
3. Prefer `href` for navigation; `href={null}` for static display.

## Verification

```bash
cd apps/frontend
npx vitest run lib/brand.test.ts components/brand/rumera-brand-mark.test.tsx lib/og/fonts.test.ts
```

Open `/opengraph-image` on a running frontend to eyeball the Persian social card.

## Follow-up

Task **061i** builds a full PWA icon set and service worker on these paths.
