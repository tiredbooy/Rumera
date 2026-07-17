# Frontend Architecture

The Rumera storefront is a **Next.js 16** App Router application (React 19,
Turbopack) that renders the Persian/RTL e-commerce experience and acts as a
**BFF** (Backend-for-Frontend) in front of the Go API. This document explains how
the app is laid out, where the server/client boundary sits, how a request flows
from the browser to the Go backend, and what the shared infrastructure
(middleware, providers, `lib/`) does.

> **This is not the Next.js you may know.** Per
> [`AGENTS.md`](../AGENTS.md), this is Next.js 16: `params`/`searchParams` are
> **async** (you must `await` them), route groups add **no URL segment**, and the
> dev/build pipeline runs on **Turbopack**. When in doubt, read the bundled docs
> under `node_modules/next/dist/docs/01-app`.

---

## 1. App Router structure & route groups

Routes live under [`app/`](../app). The top level is organised into **route
groups** — parenthesised folders that group routes under a shared layout
**without adding anything to the URL**:

| Folder              | URL prefix                                              | Layout / chrome                                                                                                     | Access              |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `app/(storefront)/` | _(none)_ — `/`, `/products`, `/cart`, …                 | [`(storefront)/layout.tsx`](<../app/(storefront)/layout.tsx>): header + footer + age gate                           | Public              |
| `app/(auth)/`       | _(none)_ — `/login`, `/register`, `/forgot-password`, … | [`(auth)/layout.tsx`](<../app/(auth)/layout.tsx>): centred minimal shell, `noindex`                                 | Public              |
| `app/(account)/`    | `/account/...`                                          | [`(account)/account/layout.tsx`](<../app/(account)/account/layout.tsx>): `AccountShell`, `force-dynamic`, `noindex` | Signed-in customers |
| `app/admin/`        | `/admin/...`                                            | [`admin/layout.tsx`](../app/admin/layout.tsx): `DashboardShell`, `force-dynamic`, `noindex`                         | Staff only          |
| `app/api/`          | `/api/...`                                              | _(route handlers, no layout)_                                                                                       | Mixed (see §4)      |

**Key consequence of "no URL segment":** the login page file is
`app/(auth)/login/page.tsx`, but its canonical path is **`/login`**. This is
called out explicitly in [`lib/auth/auth.config.ts`](../lib/auth/auth.config.ts)
(the `pages.signIn` route) and must be kept in lock-step with `middleware.ts`,
`robots.ts`, and in-app links. `admin` is a **plain folder** (not a group), so it
_does_ contribute the `/admin` segment.

```
app/
├── layout.tsx                 # root <html dir="rtl" lang="fa">, fonts, <Providers>
├── providers.tsx              # client provider stack (§5)
├── (storefront)/             # public store — header/footer/age-gate shell
│   ├── layout.tsx
│   ├── products/[slug]/page.tsx
│   ├── categories/[category]/...
│   ├── journal/[slug]/  recipes/[slug]/  search/  cart/  checkout/ …
├── (auth)/                   # login / register / password flows (noindex)
├── (account)/account/        # customer dashboard (orders, wishlist, wallet, …)
├── admin/                    # staff console (products, orders, analytics, …)
├── api/                      # BFF proxies + next-auth handlers (§4)
│   ├── admin/[...path]/route.ts
│   ├── store/[...path]/route.ts
│   ├── public/[...path]/route.ts
│   └── auth/[...nextauth]/route.ts
├── forbidden/                # 403 page (staff guard target)
├── robots.ts  sitemap.ts  manifest.ts  icon.tsx  opengraph-image.tsx  llms.txt
```

The root [`app/layout.tsx`](../app/layout.tsx) is the only place that sets
`<html lang="fa" dir="rtl">`, loads the fonts (Vazirmatn → `--font-sans`,
Markazi Text → `--font-serif`, Geist Mono → `--font-mono`), defines global
`metadata`/`viewport`, and wraps everything in `<Providers>` plus the `<Toaster>`.

**Next 16.2.6 boundary hierarchy:** a segment's `error.tsx` and `loading.tsx`
sit inside, and therefore do not wrap, that segment's own `layout.tsx`. Layout
errors bubble to the nearest parent `error.tsx`; root-layout errors are handled
by `app/global-error.tsx`, and same-segment loading UI cannot cover layout work.

---

## 2. Server vs. client component split

Everything is a **Server Component by default**. The `"use client"` boundary is
drawn deliberately and as low in the tree as possible:

- **Server Components (default):** page/layout files, server guards, and the
  feature-owned server APIs backed by `lib/api/public.ts` or `lib/api/client.ts`.
  They run on the Next server, can `await` the backend directly, and never ship
  to the browser.
  Example: [`app/(storefront)/products/[slug]/page.tsx`](<../app/(storefront)/products/[slug]/page.tsx>)
  is an `async` server component that fetches the product, reviews and
  recommendations server-side and emits JSON-LD.

- **Client Components (`"use client"`):** anything interactive or stateful —
  the provider stack ([`app/providers.tsx`](../app/providers.tsx)), React Query
  hook modules ([`lib/api/hooks.ts`](../lib/api/hooks.ts), `account-hooks.ts`,
  `admin-hooks.ts`), form components, the theme toggle, carousels, and the
  `SessionGuard`. Browser-side admin API clients are owned by their resource
  under `features/`; `store-client.ts` remains shared customer transport.

**The pattern:** a server page fetches the initial data and renders mostly static
RTL markup, then mounts small client "islands" (a purchase panel, a gallery, a
form) for interactivity. Per-user mutable data (cart, wishlist, admin tables) is
loaded **client-side** via React Query over the BFF, not in the server render —
so those surfaces stay live and personalised without server caching.

```
            SERVER (Next.js runtime)            │   CLIENT (browser)
  ──────────────────────────────────────────────┼────────────────────────────
  page.tsx (async) ─► feature server API ───────┼─► hydrated HTML
   │                    │ publicRequest          │      │
   │                    ▼                        │      ▼
   └─ renders <ClientIsland/> ───────────────────┼─► "use client" island
                                                  │      │ React Query
                                                  │      ▼
                                                  │   fetch /api/store/* (BFF) ─► §4
```

The transport depends on the caller and authentication tier:

| Helper                                                                                                                                                                                         | Runs                                 | Target                                     | Auth                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------ | -------------------------------------------------- |
| `publicRequest` ([`lib/api/public.ts`](../lib/api/public.ts)), called by feature-owned public APIs                                                                                             | Server only                          | `${API_URL}/api/v1` directly               | none                                               |
| `apiFetch` ([`lib/api/client.ts`](../lib/api/client.ts))                                                                                                                                       | Server only (`import "server-only"`) | `${API_URL}/api/v1` directly               | explicit token or bearer token pulled from session |
| `storeRequest` ([`lib/api/store-client.ts`](../lib/api/store-client.ts)), domain-owned browser clients (for example [`features/admin/uploads/client.ts`](../features/admin/uploads/client.ts)) | Browser                              | same-origin `/api/store/*`, `/api/admin/*` | handled by the BFF proxy                           |

The relevant client unwraps the backend's `{ data }` success envelope and throws
a typed server, store, or domain error built from the
`{ error: { code, message } }` envelope (see
[`apps/backend/docs/conventions.md`](../../backend/docs/conventions.md)).

---

## 3. Request / data flow

Two distinct paths reach the Go backend, depending on whether the data is fetched
during the server render or in the browser:

```
A) Server render (public storefront data)
   Browser ─► Next server: page.tsx (async)
                 └─► features/<domain>/api/* → publicRequest()
                       └─► fetch ${API_URL}/api/v1/...  (no token)
                              └─► Go backend
   Result: HTML streamed to the browser.

B) Browser interaction (per-user / authenticated data)
   Browser: "use client" + React Query
     └─► fetch /api/store/<path>      (same origin, session cookie)
           └─► Next BFF route handler: app/api/store/[...path]/route.ts
                 ├─ auth() → read bearer token from next-auth session
                 ├─ forward to ${API_URL}/api/v1/<path>  (Authorization: Bearer …)
                 └─ on 401 → silent refresh + one retry (§6)
                       └─► Go backend
```

**Why the BFF exists** (documented in each proxy's header comment): in production
the Go API is bound to **loopback behind a reverse proxy** and is _not_ reachable
from the browser, and `NEXT_PUBLIC_API_URL` is not inlined into the client
bundle. Routing browser traffic through the same-origin `/api/*` handlers means:

- The **access token never reaches the browser** — it lives in the encrypted
  next-auth session cookie and is attached server-side.
- **No CORS**, no exposed backend host; the same code works in local dev, Docker,
  and prod.
- A **path allowlist** on each proxy prevents it from becoming an open proxy.

The backend base URL is resolved from env in
[`lib/api/client.ts`](../lib/api/client.ts):
`API_URL ?? NEXT_PUBLIC_API_URL ?? http://localhost:8080`, then suffixed with
`/api/v1` → `API_BASE`. (`lib/auth/auth.ts` additionally prefers
`BACKEND_INTERNAL_URL` for the server-to-server auth calls inside Docker.)

---

## 4. The `app/api/*` BFF proxies

There are **four** route-handler families under `app/api/`. All non-auth ones use
the Next.js 16 catch-all signature with **async `params`**:

```ts
type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path); // params is awaited
}
```

| Route           | File                                                                    | Auth                                   | Allowlist (first segment unless noted)                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/store/*`  | [`store/[...path]/route.ts`](../app/api/store/[...path]/route.ts)       | next-auth session, token forwarded     | `cart`, `orders`, `addresses`, `coupons`, `shipping`, `wallet`, `wishlist`, `reviews`, `alerts`, `auth`, `loyalty`, `referrals`, `gift-cards`, `subscriptions`, `recommendations` |
| `/api/admin/*`  | [`admin/[...path]/route.ts`](../app/api/admin/[...path]/route.ts)       | requires **staff** (`isStaff`) + token | `admin`, `products`, `categories`, `brands`, `tags`, `hero-slides`                                                                                                                |
| `/api/public/*` | [`public/[...path]/route.ts`](../app/api/public/[...path]/route.ts)     | **none** (unauth forms)                | exact paths: `auth/register`, `auth/password/forgot`, `auth/password/reset`, `auth/password/validate`, `auth/otp/request`                                                         |
| `/api/auth/*`   | [`auth/[...nextauth]/route.ts`](../app/api/auth/[...nextauth]/route.ts) | next-auth internals                    | sign-in / callback / session / CSRF (handled by next-auth)                                                                                                                        |

Notes that are easy to get wrong:

- The proxied path is **relative to `/api/v1`**, so admin-namespaced endpoints
  carry a _doubled_ `admin/` segment — e.g. creating a product is
  a domain API call to `/api/admin/admin/products` →
  `${API}/api/v1/admin/products`.
- `/api/admin` preserves **`multipart/form-data` bodies verbatim** (boundary
  intact) so product image uploads pass through; `/api/store` forwards JSON only.
- All proxies pass the backend status and JSON through **unchanged**, return
  `204` as an empty body, and map a fetch failure to a `502 UPSTREAM_UNAVAILABLE`.
- Backend RBAC still runs on top — the proxy's staff check and allowlist are a
  coarse first gate, not the authority.

---

## 5. Middleware

[`middleware.ts`](../middleware.ts) is the **coarse, edge-runtime** access gate. It
runs on the Edge runtime, so it uses the Node-free `authConfig`
([`lib/auth/auth.config.ts`](../lib/auth/auth.config.ts)) — **not** the full
`auth.ts` (which contains `fetch`/`Buffer` and runs in Node).

Responsibilities:

1. For any path under `/account` or `/admin`:
   - **Not signed in** → redirect to `/login?callbackUrl=<path>`.
   - **Signed in but not staff** on `/admin` → redirect to `/forbidden`.
   - Otherwise tag the response `X-Robots-Tag: noindex, nofollow` (private
     surfaces must never be indexed).
2. Everything else passes through untouched.

The `config.matcher` excludes Next internals, `/api/auth`, and static assets.

**Defense in depth:** middleware is intentionally _not_ the authority. The
authoritative checks happen server-side in the layouts via the guards in
[`lib/auth/session.ts`](../lib/auth/session.ts):

| Guard                  | Used by                 | On failure                        |
| ---------------------- | ----------------------- | --------------------------------- |
| `requireUser()`        | `(account)` layout      | redirect `/login?callbackUrl=…`   |
| `requireStaff()`       | `admin` layout          | redirect `/login` or `/forbidden` |
| `requirePermission(p)` | per-feature admin pages | redirect `/forbidden`             |

Each guard `redirect()`s on failure (which throws, so control never returns) and
returns a **narrowed, non-null** session on success.

---

## 6. Providers (theme, query, session)

[`app/providers.tsx`](../app/providers.tsx) is a single `"use client"` component
mounted once by the root layout. The nesting order matters:

```
<SessionProvider>                 ← next-auth session context
  <SessionGuard/>                 ← signs out on terminal refresh failure
  <QueryClientProvider>           ← TanStack Query (staleTime 60s, no refetch-on-focus)
    <NuqsAdapter>                 ← URL-state (?search=… via nuqs)
      <DirectionProvider dir="rtl">   ← RTL direction context for UI primitives
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}              ← next-themes; adds .light/.dark class to <html>
```

- **Theme** — `ThemeProvider` wraps `next-themes`
  ([`components/theme-provider.tsx`](../components/theme-provider.tsx)). It toggles
  the `class` on `<html>` (`disableTransitionOnChange`), which drives the
  `parchment-light` / `candle-lit-cellar-dark` design tokens. The root `<html>`
  carries `suppressHydrationWarning` because the class is set client-side.
- **Query client** — created once via `useState(() => new QueryClient(...))` so it
  survives re-renders. Defaults: `staleTime: 60_000`, `refetchOnWindowFocus:
false`.
- **Session** — `SessionProvider` exposes `useSession()` to client code;
  `SessionGuard` ([`features/auth/components/session-guard.tsx`](../features/auth/components/session-guard.tsx))
  watches for `session.error === "RefreshAccessTokenError"` and, only on that
  _terminal_ refresh failure, calls `signOut({ callbackUrl: "/login" })`.

### Token lifecycle

Auth is next-auth v5 with the standard **split-config** pattern:

- [`auth.config.ts`](../lib/auth/auth.config.ts) — Edge-safe slice (page routes +
  the `session` callback that projects `role`, `permissions`, and `accessToken`
  onto the session). No Node-only code, so middleware can use it.
- [`auth.ts`](../lib/auth/auth.ts) — Node runtime: the Credentials providers
  (password login + SMS `otp`), and the `jwt` callback that persists the
  access/refresh pair and **silently rotates** via `POST /auth/refresh` ~60s before
  the access token expires.

If the access token expires _mid-request_, the BFF proxies (`/api/store`,
`/api/admin`) perform **one** silent refresh + retry using the server-only
refresh token (read straight from the encrypted JWT cookie via `getToken`, so it
never reaches the browser). If that refresh fails, the original 401 is returned
and the client-side `SessionGuard` signs the user out.

---

## 7. Directory map (`lib/`, `components/`, `hooks/`)

### `lib/` — non-UI logic, organised by concern

| Path                                      | What lives here                                                                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api/`                                | Shared API plumbing: `public.ts` (`publicRequest`), `client.ts` (server `apiFetch`), `store-client.ts` (customer browser BFF), shared envelope types, query helpers, and remaining shared hooks |
| `lib/auth/`                               | `auth.ts`, `auth.config.ts`, `session.ts` (server guards), `types.ts` (next-auth module augmentation)                                                                                           |
| `lib/rbac/`                               | `roles.ts` (Role→Permission map, `isStaff`, `permissionsForRole`), `permissions.ts` (`PERMISSIONS` catalogue), `can.ts` (`can`/`hasAny`/`hasAll`), `nav.ts` (permission-filtered sidebar)       |
| `lib/seo/`                                | `metadata.ts` (`buildMetadata` / `noindexMetadata`), `jsonld.ts` (structured-data builders)                                                                                                     |
| `lib/home/`, `lib/journal/`, `lib/admin/` | Section-specific server data helpers                                                                                                                                                            |
| `lib/` (root)                             | `site.ts` (`siteConfig`, `absoluteUrl`), `utils.ts` (`cn`), `products.ts` (`faNum`, `categoryFa`, sample data), `recipes.ts`, `journal.ts`, `recently-viewed.ts`                                |

Admin browser clients live with their resource under `features/` rather than in
`lib/api/`; standalone image uploads, for example, are owned by
`features/admin/uploads/`.

Public server APIs are also feature-owned: products/categories under
`features/catalog/`, plus recipes, journal, reviews, and recommendations under
their matching domains. They call `publicRequest()` and choose caching per read:
the live product list is `no-store`; cached product detail, categories, recipes,
and journal reads generally revalidate at `3600s`.

**Success vs. failure contract:** successful primary lists may be genuinely
empty, but network/5xx/non-404 failures throw into the nearest route boundary.
Direct product, recipe, and journal details return `null` only for a typed
`ApiError` 404. Optional PDP recommendation and review enrichments remain
intentionally error-safe and may fall back to empty/null without changing the
primary product-detail semantics. Authenticated/per-user fetches default to
`cache: "no-store"`.

Only slug discovery in each dynamic product/category/recipe/journal route's
`generateStaticParams()` is fail-soft and returns `[]`. That does not make a
complete API-offline `next build` safe: static storefront pages/layouts and the
sitemap still need live API data or a populated cache.

### `components/` — UI, grouped by surface

- `components/ui/` — the shadcn/Radix primitive layer (~55 components: button,
  dialog, table, form, etc.) plus the RTL `direction` provider.
- Surface folders: `account/`, `admin/`, `dashboard/`, `auth/`, `cart/`,
  `catalog/`, `checkout/`, `home/`, `journal/`, `recipes/`, `loyalty/`,
  `subscriptions/`, `taste/`, `wallet/`, `referral/`, `motion/`.
- Top-level shared chrome: `site-header.tsx`, `site-footer.tsx`, `age-gate.tsx`,
  `product-card.tsx`, `add-to-cart-button.tsx`, `theme-provider.tsx`,
  `mode-toggle.tsx`, `json-ld.tsx` / `structured-data.tsx`, `smart-image.tsx`.

### `hooks/`

Sparse — currently just `hooks/use-mobile.ts`. Most stateful logic is colocated
as React Query hooks under `lib/api/`, not in `hooks/`.

---

## 8. Next.js 16 specifics to remember

- **Async dynamic APIs.** `params` and `searchParams` are `Promise`s — always
  `await` them. Pattern seen throughout, e.g.
  `const { slug } = await params` in
  [`products/[slug]/page.tsx`](<../app/(storefront)/products/[slug]/page.tsx>) and
  `(await ctx.params).path` in every BFF route handler.
- **Route groups add no URL segment** — `(storefront)`, `(auth)`, `(account)`
  shape layout/grouping only; the URL comes from the _non-parenthesised_ folders
  (so login is `/login`, account pages are `/account/...`).
- **Turbopack** powers dev and build (`next dev` / `next build`; see
  [`README.md`](../README.md)).
- **`output: "standalone"`** ([`next.config.ts`](../next.config.ts)) for a minimal
  Docker image, plus `optimizePackageImports` for `lucide-react`/`motion`/etc.,
  security headers, and AVIF/WebP image negotiation.
- **Rendering modes are explicit per route:** dashboards declare
  `export const dynamic = "force-dynamic"`; cacheable catalogue pages declare
  `export const revalidate = 3600` and may use `generateStaticParams`.
- **File conventions** drive SEO/PWA: `app/robots.ts`, `app/sitemap.ts`,
  `app/manifest.ts`, `app/icon.tsx`, `app/opengraph-image.tsx`, and `app/llms.txt`.

---

## Quick mental model

> Server components fetch **public, cacheable** catalogue data directly from the
> Go API and render RTL HTML. Client islands fetch **per-user, authenticated**
> data through the same-origin **BFF proxies**, which attach the bearer token
> server-side (browser never sees it) and silently refresh it. Middleware does a
> fast edge bounce for `/account` + `/admin`; the **layout-level server guards**
> are the real authority; **RBAC permissions** (derived from the role) gate
> individual admin features.
