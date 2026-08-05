# Rumera logo assets

Canonical brand artwork for the storefront, auth, admin, and install surfaces.

## Files (do not rename without updating `lib/brand.ts`)

| File | Role | Measured size | Notes |
|------|------|---------------|--------|
| `Rumera-Light.svg` / `.png` | Mark on **light** surfaces | 446×377, RGBA | Black monogram, transparent bg |
| `Rumra-Dark.svg` / `.png` | Mark on **dark** surfaces / icons | 435×388, RGBA | Dark-field badge (filename typo kept) |

## Usage rules

1. **Never** hardcode `/logo/...` in components — import from `@/lib/brand`.
2. Render through **`RumeraBrandMark`** (`components/brand/rumera-brand-mark.tsx`).
3. Prefer **SVG** in UI; PNG for raster-only contexts (OG generation, some PWA tools).
4. Keep **object-contain** and fixed aspect boxes — do not stretch or crop the mark.
5. Linked marks use a **min 44×44px** hit target (mobile-first).
6. When the wordmark is already visible, pass **`decorative`** so alt text is not duplicated.

## Themes

| `tone` | When |
|--------|------|
| `auto` (default) | Light asset in light mode; dark badge in dark mode |
| `on-light` | Forced light-surface monogram |
| `on-dark` | Forced dark-field badge (auth / cellar glow shells) |

## Metadata & install

- Tab / PWA icons → dark-field PNG (`brandPaths.iconPng`)
- Apple touch → same badge
- Open Graph → generated `/opengraph-image` (embeds brand)

Task **061i** extends the icon set for full PWA install (multiple densities).
