# Rumera Storefront — Frontend Documentation

The customer-facing storefront **and** admin console for Rumera, a Persian
(Farsi, RTL) luxury wine/spirits e-commerce brand. Built with **Next.js 16**
(App Router, Turbopack), **React 19**, **Tailwind CSS 4**, **shadcn/ui**,
**TanStack Query**, and **next-auth v5**.

This is the documentation home for the frontend. Start here, then follow the
links below.

> ⚠️ **This is Next.js 16** — APIs and conventions differ from older versions.
> `params`/`searchParams` are **async** (you must `await` them), route groups
> add **no URL segment**, and dev/build run on **Turbopack**. See
> [`../AGENTS.md`](../AGENTS.md); the authoritative framework docs are bundled
> under `node_modules/next/dist/docs/01-app`.

## Contents

| Guide                                           | What it covers                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [Architecture](./architecture.md)               | App Router layout, route groups, server/client split, request flow, providers, the `lib/`/`components/` map                             |
| [BFF Proxy & Auth / Session](./bff-and-auth.md) | The `app/api/{public,store,admin}/*` proxies, next-auth v5 split-config, token lifecycle, silent refresh, `SessionGuard`                |
| [RBAC](./rbac.md)                               | Roles, the `lib/rbac/*` permission model, `can()`/`filterNav()`, server guards, and how it maps onto backend enforcement                |
| [API Layer](./api-layer.md)                     | Server and store fetch clients, domain-owned admin clients, React Query hooks, query keys, error types                                  |
| [Design System](./design-system.md)             | Design tokens (`--gold`/`--wine`), the two themes, RTL logical props, `font-serif` headings, brand utilities, `faNum()`/`formatPrice()` |
| [Data Fetching](./data-fetching.md)             | Feature-owned public server APIs, typed 404/error-boundary semantics, caching, and when to use React Query                              |

### See also

- [`../README.md`](../README.md) — storefront overview, getting started, scripts,
  SEO surfaces, and the home-page composition.
- [`../AGENTS.md`](../AGENTS.md) — the Next.js 16 ground rules every contributor
  must read before writing code.
- [`../../backend/docs/`](../../backend/docs/) — the Go API these clients call
  (the `{ data }` / `{ error: { code, message } }` envelope, JWT/auth, endpoints).

## Where do I start?

New to the frontend? Read [`../AGENTS.md`](../AGENTS.md) first (Next.js 16 is not
the Next.js you remember), then [`architecture.md`](./architecture.md) for the
big picture — how routes, the server/client boundary, and the BFF fit together.
From there, branch by what you're building: a **storefront/account/admin page**
sends you to [`data-fetching.md`](./data-fetching.md) and
[`api-layer.md`](./api-layer.md); anything touching **login, sessions, or the
`/api/*` proxies** to [`bff-and-auth.md`](./bff-and-auth.md); **who-sees-what in
the admin console** to [`rbac.md`](./rbac.md); and **visual/RTL work** to
[`design-system.md`](./design-system.md). Run the app with `npm run dev`
(http://localhost:3000) and keep `../README.md` open for scripts and env vars.

## The 30-second tour

```
Browser
   │
   ├─ A) Server render (public storefront data) ───────────────────┐
   │     page.tsx (async)  →  features/<domain>/api/*                 │
   │                            └─► publicRequest() → /api/v1/... (no token)
   │                                                                 ▼
   │                                                            Go backend
   │
   └─ B) Browser interaction (per-user / authenticated) ────────────┐
         "use client" + React Query                                 │
           └─► fetch /api/store/* (same origin, session cookie)     │
                  └─► Next BFF route handler                         │
                       ├─ Auth.js wrapper → rotate/persist if needed│
                       ├─ forward to ${API_URL}/api/v1/...          │
                       └─ bearer remains server-side                ▼
                                                               Go backend
```

> **Mental model:** Server components fetch public storefront data through
> feature-owned APIs backed by `publicRequest()` and render RTL HTML. Client
> islands fetch **per-user, authenticated** data through the same-origin **BFF
> proxies**, which attach the bearer token server-side (the browser never sees
> it) and persist single-use refresh rotation through Auth.js route responses.
> Edge middleware does a fast bounce for `/account` + `/admin`; **layout-level
> server guards** are the real authority; **RBAC permissions** gate individual
> admin features in the UI. See [`architecture.md`](./architecture.md) for the
> full picture.

## Directory conventions cheat-sheet

```
app/
  layout.tsx        # root <html dir="rtl" lang="fa">, fonts, <Providers>
  providers.tsx     # client provider stack (session → query → nuqs → theme)
  (storefront)/     # public store  — URL: /, /products, /cart, …   (group: NO segment)
  (auth)/           # login/register/password flows — URL: /login, … (group: NO segment, noindex)
  (account)/account/# customer dashboard — URL: /account/…           (force-dynamic, noindex)
  admin/            # staff console — URL: /admin/…   ← real path segment, NOT a group
  api/              # BFF proxies + next-auth handlers (route handlers, no layout)
    {public,store,admin}/[...path]/route.ts   # async params: (await ctx.params).path
    auth/[...nextauth]/route.ts
  forbidden/        # 403 target for the staff guard
  robots.ts sitemap.ts manifest.ts icon.tsx opengraph-image.tsx llms.txt
lib/
  api/    # public.ts, client.ts (server apiFetch), store-client.ts, envelope/query plumbing
  auth/   # auth.ts (Node), auth.config.ts (Edge-safe), session.ts (server guards), types.ts
  rbac/   # permissions.ts, roles.ts, can.ts, nav.ts
  seo/    # metadata.ts, jsonld.ts
  home/ journal/ admin/           # section-specific server data helpers
  site.ts utils.ts products.ts recipes.ts journal.ts recently-viewed.ts
components/
  ui/                              # shadcn/Radix primitives (+ RTL direction provider)
  account/ admin/ dashboard/ auth/ cart/ catalog/ checkout/ home/ journal/
  recipes/ loyalty/ subscriptions/ taste/ wallet/ referral/ motion/   # by surface
  site-header.tsx site-footer.tsx age-gate.tsx product-card.tsx smart-image.tsx …
hooks/    # sparse — just use-mobile.ts; most stateful logic is React Query under lib/api/
features/ # business domains and resource-owned public/admin APIs
middleware.ts  next.config.ts  globals.css  components.json
```

Quick rules of thumb:

| Convention           | Rule                                                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route groups `(…)`   | Add **no** URL segment — they only share a layout. `/login` lives at `app/(auth)/login/page.tsx`.                                                                                                          |
| `app/admin/`         | A **real** path segment (not a group); contributes `/admin`.                                                                                                                                               |
| Dynamic APIs         | `await params` / `await searchParams`; in BFF handlers `(await ctx.params).path`.                                                                                                                          |
| Server vs. client    | Server Component by default. Add `"use client"` as **low** in the tree as possible.                                                                                                                        |
| Browser API calls    | Go through the BFF: `storeRequest()` or a domain-owned client → `/api/{store,admin}/*`. Never hit the backend host directly.                                                                               |
| Server API calls     | Public reads use feature-owned server APIs backed by `publicRequest`; authenticated reads use `apiFetch` from `lib/api/client.ts`.                                                                         |
| Caching and failures | Each public domain API chooses its cache policy. Successful primary lists may be empty; failed primary reads throw to route boundaries, and primary direct detail reads return `null` only for typed 404s. |
| Rendering mode       | Declare it per route: dashboards `export const dynamic = "force-dynamic"`; cacheable pages `export const revalidate = 3600`.                                                                               |
| RTL                  | Logical properties only — `ps`/`pe`/`ms`/`me`, never `pl`/`pr`/`ml`/`mr`. Numbers via `faNum()`, prices via `formatPrice()`.                                                                               |
| Access control       | Edge `middleware.ts` (coarse) → `lib/auth/session.ts` server guards (authoritative) → backend RBAC (the real gate).                                                                                        |

Only dynamic route slug discovery in `generateStaticParams()` is fail-soft.
Static storefront pages/layouts and the sitemap still require API data or a
populated cache, so a complete `next build` is not guaranteed with every API
offline.
