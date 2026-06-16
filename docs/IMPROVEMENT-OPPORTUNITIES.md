# Rumera — Improvement Opportunities (monorepo-wide)

> Synthesized from a 7-agent parallel discovery sweep (read-only, evidence-cited): frontend UX, frontend performance, accessibility/SEO/RTL, DevOps/CI, DX/tooling, product features, growth/analytics/search. Backend *correctness* is covered separately in `apps/backend/BACKEND-IMPROVEMENTS.md`. Items marked **⚑** were corroborated by 2+ agents → highest confidence.

---

## ★ The headline finding (⚑ found by 3 agents)
**The backend is far more complete than the storefront exposes.** Whole subsystems are built server-side but never called by the UI:
- **Recommendation engine** — `/recommendations/{trending,for-you,products/:id/similar,products/:id/frequently-bought-together,interactions}` (`internal/routes/routes.go:120-122,201-204`) is fully implemented (`recommendation_svc.go`) but the **frontend calls none of it**; PDP "related" is a naive same-category fetch, the home "For You" rail just echoes the taste quiz.
- **Reviews** — `GET /products/:id/reviews` + `/reviews/summary` with photos, verified-purchase, helpful-votes (`review_svc.go`) exist, but reviews are **write-only** in the UI and never displayed on the PDP.
- **Wishlist** — full CRUD (`/wishlist*`, `routes.go:181-186`) exists; the UI uses **hardcoded sample data** and product cards have no add-to-wishlist control.
- **Interactions / taste profile** — endpoints exist; the frontend records nothing, so personalization stays cold.

Surfacing these is mostly **frontend work, low-risk, high-impact** — the biggest "make it way better" lever available.

---

## Epics (each independently designable / shippable)

### Epic A — Surface the existing backend on the storefront  ⚑  *(impact: ★★★, risk: low, mostly FE)*
1. **PDP reviews block** — ratings summary, list with photos, verified badge, helpful votes. *(S)*
2. **Wishlist wired to real API** — heart on product cards + PDP; account wishlist reads live data; back-in-stock alert tie-in. *(S–M)*
3. **Recommendation rails** — PDP "similar" + "frequently bought together"; home "trending" + authed "for-you"; record `interactions` on view/add-to-cart. *(M)*
4. **Recently-viewed rail** — localStorage for guests, interactions-backed for users. *(S)*

### Epic B — Storefront UX polish (the less-polished pages)  *(impact: ★★, risk: low, FE)*
- Cart: toast on remove/qty (+undo), breadcrumb (`cart-lines.tsx:90`). · Order detail: dead "invoice/track" buttons → disabled-with-reason (`order-detail.tsx:186,195`).
- Auth: password show/hide toggle, login success toast, promote auth card to `.glass` (`login-form.tsx:70`, `(auth)/layout.tsx:16`).
- Checkout: glass stepper, shipping error state, coupon pending/success feedback (`checkout-flow.tsx:310,394`).
- Touch targets <44px on recipe/journal filters + pagination + address icons. · Journal body → `.prose-rumera`. · `add-all-button` disabled state instead of `null`.

### Epic C — Accessibility & SEO hardening  *(impact: ★★, risk: low, FE)*
- **Skip-to-content link** + root `<main>` landmark (`app/layout.tsx`). · Mobile menu `aria-expanded`. · Gallery thumb alt text.
- **Home structured data uses fake demo products** (`structured-data.tsx:13`) → build from live catalog. · Home page has no `generateMetadata`. · Journal `BlogPosting` missing `image`/publisher logo. · Manifest missing 192/512 maskable icons. · `/checkout` not in robots disallow.
- **RTL logical-prop fixes** in shared primitives: carousel arrows (`carousel.tsx:193,223`), OTP corners (`input-otp.tsx:58`), button-group (`button-group.tsx:13`).

### Epic D — Frontend performance  *(impact: ★★, risk: low–med, FE)*
- Code-split **recharts** in admin via `next/dynamic` (no dynamic imports exist anywhere). · `components/ui/table.tsx` wrongly `"use client"` → poisons server pages. · Account overview: server-prefetch + `HydrationBoundary` for the 6 on-mount queries. · `priority` on first-row listing/category images + hero category tile. · Checkout shipping fetched with hardcoded `weight=0` (correctness). · Drop dead deps (tiptap, react-day-picker) after verification. · Tighten `images.remotePatterns` from `**`.

### Epic E — Backend money/data-integrity hardening  ⚑  *(impact: ★★★, risk: med, BE + tests)*  → see `apps/backend/BACKEND-IMPROVEMENTS.md`
- **Free-money `/wallet/deposit`** removal. · Atomic order→stock and payment→stock (oversell / inventory drift). · Coupon usage-limit race. · `Config.Validate()` guards (JWT secret length, reject CORS `*`/empty webhook key/`SMS=log` in prod). · `models.Err*` → 500 fix (use `h.handleError`). · Missing DB indexes on payment/wallet/inventory hot tables. · Rate-limit fail-open + trusted proxies.

### Epic F — Observability, CI & infra  ⚑  *(impact: ★★, risk: low–med, infra)*
- **No CI exists** (the `.golangci.yml` "CI runs it" claim is fictional) → add GH Actions: BE `golangci-lint`+`go test -race`, FE `lint`+`tsc`+`build`. · Wire Prometheus/Grafana (artifacts exist, nothing scrapes). · Business metrics (orders/payments/revenue) + saga tracing spans. · nginx prod: security headers, `server_tokens off`, rate-limit, enable TLS. · Pin floating image tags; add backend `.dockerignore`; DB backup strategy. · `Dockerfile.dev` `GOSUMDB=off` supply-chain weakening.

### Epic G — Analytics & search  ⚑  *(impact: ★★★ growth, risk: low–med)*
- **PostHog is a dependency but never initialized** — zero client analytics → add provider + funnel events (`add_to_cart`/`begin_checkout`/`purchase`+revenue/`signup`). · Server analytics middleware emits **empty payloads**, so search/term reports aggregate over NULLs (`analytics.go:69` vs `search_job.go:55`). · Search is `title ILIKE` only — add `pg_trgm` + Persian normalization (ك→ک, ي→ی, ZWNJ) + brand/category/description match + facets. · Order-confirmation email is **English, hardcoded, IRR as `%.2f`** on a Persian store (`handlers/order.go:60`) → localized Persian template. · Missing lifecycle emails (welcome, abandoned-cart, shipping status, review request).

### Epic H — DX / type-safety  *(impact: ★★, risk: low, tooling)*
- FE↔BE **type drift** (hand-mirrored, no OpenAPI) → generate types from a spec. · FE test harness (vitest/playwright) installed but **0 tests, 0 config, no `test` script**. · 3 divergent API error classes + inconsistent envelope unwrapping. · No root README, no Prettier config, no pre-commit hooks, no `typecheck` script. · `lib/admin/data.ts` mocks still wired into live admin pages.

---

## Verified-clean (don't waste effort)
No committed secrets · prod Docker/compose genuinely hardened (non-root, secret guards, healthchecks) · migrations have full down-coverage · strong JSON-LD baseline on dynamic routes · `lang/dir` + reduced-motion respected · Radix focus-trapping · zero `any` in FE · no FE data-fetching waterfalls · QueryClient sanely configured.

---

## Recommended first slice
**Epic A (surface the existing backend)** is the highest impact-per-effort: it's the headline finding, mostly frontend, low-risk to ship to `dev`, and ties directly to the UI/UX focus. Epic E (money integrity) is the most *important* but higher-risk and needs tests — best as a dedicated, carefully-reviewed pass. Pick per priority: ship visible value now (A/B/C) or harden the foundation (E/F).
