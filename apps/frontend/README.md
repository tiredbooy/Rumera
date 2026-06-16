# Rumera — Storefront

The customer-facing storefront for Rumera, a premium spirits, wine & champagne
e-commerce brand. Built with **Next.js 16 (App Router, Turbopack)**, **React 19**,
**Tailwind CSS 4** and **shadcn/ui**, with a warm "candle-lit cellar" design
system.

> ⚠️ This is **Next.js 16** — APIs and conventions differ from older versions.
> See [`AGENTS.md`](./AGENTS.md). Authoritative docs are bundled under
> `node_modules/next/dist/docs/`.

---

## Getting started (local)

```bash
npm install
npm run dev          # http://localhost:3000
```

Or run the whole platform (storefront + API + databases) with Docker — see
[`../../docs/DOCKER.md`](../../docs/DOCKER.md):

```bash
# from the repo root
docker compose -f docker-compose.dev.yml up --build --watch
```

Scripts:

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server with Fast Refresh |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

---

## The home page

The landing page (`app/page.tsx`) is a **Server Component** — it ships as static
HTML with almost no client JavaScript, which is what keeps it fast and
SEO-friendly. It's composed of:

- **Hero** — brand statement + an editor's-pick bottle. Deliberately **not**
  JS-animated so it paints immediately (good LCP).
- **Perks** strip, **maker marquee**, **categories** bento grid, **featured
  bottles**, **brand story**, **testimonial** and a **membership CTA**.

### Performance-minded interactivity

- **`components/motion/reveal.tsx`** — a tiny `"use client"` island built on
  [`motion`](https://motion.dev). It fades/lifts sections in the first time they
  scroll into view (`once: true`), and fully respects
  `prefers-reduced-motion`. Because it's an island, wrapping server-rendered
  content in `<Reveal>` keeps that content on the server.
- **`components/brand-marquee.tsx`** — an infinite maker marquee that is
  **pure CSS** (a keyframe in `globals.css`), so it costs **zero** client JS,
  runs on the compositor, and pauses on hover.
- **Bottle visuals** (`components/bottle.tsx`) are inline SVG — no image
  requests, no broken images, infinitely crisp.

### Other speed levers (`next.config.ts`)

- `output: "standalone"` for a minimal Docker runtime.
- `optimizePackageImports` for `lucide-react`, `motion`, `date-fns`, … so only
  the used symbols ship.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`); `poweredByHeader: false`;
  no production browser source maps.

---

## SEO

Everything brand/SEO-related is centralized in **`lib/site.ts`** (name, URL,
description, socials) and consumed across the metadata APIs so it never drifts.

| Surface | File | Notes |
|---------|------|-------|
| Title/description, OpenGraph, Twitter card, robots, canonical, `metadataBase` | `app/layout.tsx` | Driven by `lib/site.ts` |
| `theme-color`, color scheme | `app/layout.tsx` (`viewport`) | Light/dark aware |
| **Structured data (JSON-LD)** | `components/structured-data.tsx` | `Organization` + `WebSite` (with `SearchAction`) + `ItemList` of products → rich results, zero client JS |
| `sitemap.xml` | `app/sitemap.ts` | Home + every category + every product |
| `robots.txt` | `app/robots.ts` | Allows all, points at the sitemap |
| Web manifest | `app/manifest.ts` | Installable / PWA metadata |
| Social share image | `app/opengraph-image.tsx` | Branded, generated via `next/og` |
| Favicon / brand mark | `app/icon.tsx` | Generated via `next/og` |

`NEXT_PUBLIC_SITE_URL` controls the canonical origin used by all of the above —
set it per environment (it's inlined at build time).

---

## Project structure

```
app/
  layout.tsx            # root layout, fonts, metadata, viewport
  page.tsx              # home page (Server Component)
  providers.tsx         # React Query + theme providers
  globals.css           # design tokens + brand utilities + marquee keyframes
  sitemap.ts robots.ts manifest.ts opengraph-image.tsx icon.tsx
components/
  motion/reveal.tsx     # scroll-reveal client island
  brand-marquee.tsx     # pure-CSS marquee
  structured-data.tsx   # JSON-LD
  product-card.tsx bottle.tsx site-header.tsx site-footer.tsx age-gate.tsx
  ui/                   # shadcn/ui primitives
lib/
  site.ts               # brand/SEO source of truth
  products.ts           # catalogue (demo data) + helpers
```

---

## Environment

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for SEO (metadata, sitemap, robots) |
| `NEXT_PUBLIC_API_URL` | Browser-facing API base URL |

See the root [`.env.example`](../../.env.example).
