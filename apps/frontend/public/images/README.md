# Image assets & size spec

Drop real imagery at the paths below and it lights up automatically — every
image renders through `<SmartImage>` (`components/smart-image.tsx`), which falls
back to an on-brand gradient placeholder when a file is missing. So the site
looks intentional with **zero** images, and progressively improves as you add
them. No code changes needed.

All photos should be `object-cover` friendly (the focal subject centered) and
exported as **WebP or AVIF** where possible — Next.js also re-encodes/optimizes
them at request time (`next.config.ts` → `images.formats`).

## Paths & recommended sizes

| Surface | Path | Aspect | Recommended (px) | `sizes` hint |
| --- | --- | --- | --- | --- |
| Home hero — desktop | `hero/slide-{n}.jpg` | 16:9 | **2400×1350** | `100vw` |
| Home hero — mobile (optional) | set `mobile_image_url` on the slide | 4:5 | **1080×1350** | `100vw` |
| Category tile | `categories/{slug}.jpg` (e.g. `whisky.jpg`) | 4:5 | **1200×1500** | up to `50vw` |
| Product card | `products/{slug}.jpg` (or `Product.image`) | 4:5 | **1000×1250** | up to `25vw` |
| Recipe card | recipe `image_url` (API) | 4:3 | **1200×900** | up to `33vw` |
| Recipe hero | recipe `image_url` / `og_image_url` | 4:3 | **1600×1200** | up to `50vw` |
| Story / about (square) | `story/rumera-cellar.jpg` | 1:1 | **1200×1200** | up to `50vw` |
| About hero | `about/rumera-team.jpg` | 4:3 | **1400×1050** | up to `50vw` |
| Brand logo (optional) | `brands/{brand}.svg` | — | height ~32px, transparent | — |

> Hero slides are **admin-managed** via the `/hero-slides` API. The `image_url`
> there can be either a path in this folder (e.g. `/images/hero/slide-1.jpg`) or
> a full CDN/object-storage URL. Remote HTTPS hosts are already permitted in
> `next.config.ts` (`images.remotePatterns`) — tighten that to your real CDN
> origin before production.

> **Journal/blog posts** currently have no cover-image field in the backend, so
> their cards/heroes render SmartImage's branded placeholder. Add a `cover_image`
> column to `blogs` (16:9, ~1600×900) and surface it in `lib/journal.ts` to light
> them up.

## Category slugs

Category tiles resolve `categories/{slug}.jpg` from the lowercase English
category name: `whisky`, `wine`, `champagne`, `gin`, `rum`, `tequila`, `vodka`.
