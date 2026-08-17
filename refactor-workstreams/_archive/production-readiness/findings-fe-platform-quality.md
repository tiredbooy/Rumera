# Findings — fe-platform-quality

**Workstream:** `production-readiness-20260816`  
**Agent:** `fe-platform-quality`  
**Date:** 2026-08-16  
**Mode:** Investigation only. No application code changed.

IDs use **PR-040+** so they do not collide with `fe-storefront` (PR-020) or `fe-commerce-account` (PR-030).

---

## What I inspected

| Area | Paths |
| --- | --- |
| BFF | `apps/frontend/app/api/admin/[...path]/route.ts`, `…/store/…`, `…/public/…` |
| Proxy path hardening | `lib/api/admin-proxy-path.ts` (+ test) |
| Clients / envelopes | `lib/api/{base,client,public,store-client,types,qs,errors,error-semantics,endpoints,query-keys}.ts` |
| Auth | `lib/auth/{auth.ts,auth.config.ts,session.ts,live-account.ts,access-token.ts,types.ts}`, `app/api/auth/**`, `proxy.ts` |
| Next config / SEO | `next.config.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`, `app/llms.txt/route.ts`, `lib/seo/metadata.ts`, `app/layout.tsx` |
| a11y / RTL | `components/ui/{dialog,sheet,button,table,carousel,drawer}.tsx`, `features/admin/analytics/components/DataTable.tsx`, image uploader |
| Observability | Sentry / PostHog greps, `app/global-error.tsx`, `app/providers.tsx` |
| Deps | `package.json` vs importers |
| FE-facing ops | `apps/frontend/Dockerfile`, `docker-compose.prod.yml` frontend/nginx, `infra/nginx/nginx.prod.conf` |
| Hint list | IMPROVEMENT 5.15, 5.18, 6.2, 6.12, 6.13, 6.14, 6.15, 6.19 |

Already claimed (not re-proposed): **PR-003c** Idempotency-Key BFF forward.

---

## Re-verify IMPROVEMENT rows (evidence)

### 5.15 `@sentry/nextjs` unwired — **DONE PR-090d** (2026-08-16)

- Removed unused `@sentry/nextjs` from `apps/frontend/package.json` + lockfile.
- No `SENTRY_DSN` in env; no `sentry.*` / `instrumentation*.ts`; never initialized.
- `app/global-error.tsx` still `console.error` only (no invented DSN).
- `posthog-js` is unchanged (PR-090e).

### 5.18 `images.remotePatterns` hostname `**` — **FIXED PR-090c**

`next.config.ts` builds `remotePatterns` from `NEXT_PUBLIC_MEDIA_BASE_URL` then
`NEXT_PUBLIC_API_URL` (protocol + hostname + port). Wildcard hostnames are
rejected. Empty env → empty allow-list (same-origin `/media` via nginx).

Storefront `SmartImage` still **bypasses** `next/image` for `/media` and
absolute `http(s)`. Residual: a `next/image` remote `src` on a host that is
neither env origin (e.g. a one-off brand-logo CDN) will fail the optimizer.

### 6.2 Dead npm deps — **STILL LIVE** (membership changed)

**Zero application importers (safe remove after one more grep at implement time):**

| Package | Notes |
| --- | --- |
| `axios` | unused |
| `qs` | unused (`lib/api/qs.ts` is a local `URLSearchParams` helper) |
| `lodash-es` + `@types/lodash-es` | only listed in `optimizePackageImports` |
| `zustand` | unused |
| `nanoid` | unused (idempotency keys use `crypto.randomUUID`) |
| `@tanstack/react-virtual` | only mentioned in `DASHBOARD-PLAN.md` |
| `@tanstack/react-query-devtools` | unused (not mounted in `providers.tsx`) |
| `posthog-js` | installed, never initialized (PR-090e) |
| `shadcn` | CLI shipped as a **runtime** dependency |

`uploadthing` is **not** in `package.json` (plan-only leftover in `DASHBOARD-PLAN.md`).

**Imported only by unused shadcn primitives** (remove primitive + package together):

| Package | Only importer |
| --- | --- |
| `vaul` | `components/ui/drawer.tsx` (no feature import) |
| `cmdk` | `components/ui/command.tsx` (no feature import) |
| `react-day-picker` | `components/ui/calendar.tsx` (no feature import) |
| `react-resizable-panels` | `components/ui/resizable.tsx` (no feature import) |

Unused primitives with **no** feature imports:  
`aspect-ratio`, `breadcrumb`, `button-group`, `calendar`, `carousel`, `command`, `context-menu`, `drawer`, `hover-card`, `menubar`, `pagination`, `resizable`, `sidebar`, `slider`.

**Missing direct deps (imported, not declared):**  
`@tiptap/extension-underline` and `@tiptap/extension-link` in `components/admin/rich-text-editor.tsx`. They exist only as lockfile transitives of `@tiptap/starter-kit`. A clean install / hoist change can break admin editors.

**Still used (do not remove):** `next-themes`, `nuqs`, `recharts`, `swiper`, `motion`, `react-markdown`, `remark-gfm`, `input-otp`, `react-icons`, `@base-ui/react`, `embla-carousel-react`, `radix-ui`.

### 6.12 `/checkout` indexable + skip + manifest — **MOSTLY FIXED**

| Sub-item | Status | Evidence |
| --- | --- | --- |
| Skip-to-content | **Fixed** | `app/layout.tsx` L135–140 `رفتن به محتوای اصلی` → `#main-content`. Storefront/account/admin/auth shells set `id="main-content"`. `e2e/keyboard.spec.ts` + `layout.test.tsx`. |
| Manifest icons | **Fixed** | `app/manifest.ts` 512 `any` + `maskable` via `/icon`, plus 180 apple. Residual polish: no dedicated 192. |
| Checkout indexable | **Half** | `app/(storefront)/checkout/layout.tsx` L13: `noindexMetadata("تسویه حساب")`. `robots.ts` disallow list has `/cart` `/account` `/admin` `/search` but **not `/checkout`**. |

Sitemap (`app/sitemap.ts`) covers home, products, categories, tags, recipes, journal, faq, about. **`/brands` is a live public indexable page** (`app/(storefront)/brands/page.tsx`) and is **absent** from the sitemap static routes.

### 6.13 Dialog/Sheet RTL close — **STILL LIVE**

```71:80:apps/frontend/components/ui/dialog.tsx
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-4 bg-secondary"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
```

Same pattern in `sheet.tsx` L73–80. `DialogFooter` optional button is English `"Close"` (L118). Unused `carousel.tsx` uses physical `-left-12` / `-right-12` and English “Previous/Next slide”. Unused `drawer.tsx` uses `data-[vaul-drawer-direction=left/right]` physical sides.

Used surfaces (age-gate dialog, mobile nav sheet) inherit the physical `right-4` close control in `dir="rtl"`.

### 6.14 DataTable keyboard + image reorder — **FIXED**

- `DataTable.tsx` no longer uses `<tr onClick>`. `rowHref` renders a real `<Link>` on the primary column with `min-h-11` + focus ring (L288–294).
- `DataTable.test.tsx` asserts the link and `aria-sort`.
- `features/image-uploader/ImageSlotItem.tsx` has up/down controls (`data-image-reorder`) + `ImageSlotList.test.tsx` “keyboard reordering”.

### 6.15 32px default icon — **MOSTLY MITIGATED**

```7:33:apps/frontend/components/ui/button.tsx
  "… [@media(any-pointer:coarse)]:min-h-11 [@media(any-pointer:coarse)]:min-w-11 …"
        default: "h-8 …",
        icon: "size-8",
        "icon-xs": "size-6 …",
        "icon-sm": "size-7",
```

`button.test.tsx` locks the 44px coarse-pointer hit area. Fine-pointer / desktop still 32px (or 24/28 for xs/sm). Residual is polish, not a mobile WCAG miss.

### 6.19 boot log / scripts / no-console — **PARTLY FIXED**

- `package.json` now has `"typecheck": "tsc --noEmit"` and `"test": "vitest run --passWithNoTests"`.
- `lib/auth/auth.ts:37` is **not** an API URL log anymore (that row is stale).
- Residual: `eslint.config.mjs` has **no** `no-console`. `auth.ts` still logs `❌ Authorize fetch error` / `❌ OTP authorize fetch error`. No husky / lint-staged / pre-commit.

---

## Live bugs / gaps (new or still open)

### P0 — Prod frontend container has no Auth.js secret

`docker-compose.dev.yml` frontend env includes `AUTH_SECRET` and `AUTH_URL`.  
`docker-compose.prod.yml` frontend `environment` (L197–210) has `NEXT_PUBLIC_*`, `API_URL`, `BACKEND_INTERNAL_URL`, Prometheus/Grafana — **no `AUTH_SECRET`, no `AUTH_URL`**. Compose does not auto-inject host `.env` keys unless listed.

`.env.prod.example` marks both required. `auth.ts` / `auth.config.ts` read `process.env.AUTH_SECRET`. There is **no** `trustHost: true`.

**Effect:** production NextAuth cookie signing / URL resolution is undefined behind nginx. Login/session can fail or use an unstable secret across restarts.

### P1 — Access token is copied onto the client session

BFF comments claim the bearer “never reaches the browser”. The session callback does the opposite:

```26:33:apps/frontend/lib/auth/auth.config.ts
    session({ session, token }) {
      const role = (token.role as Role) ?? "customer";
      session.role = role;
      session.permissions = permissionsForRole(role);
      session.accessToken = token.accessToken;
```

`SessionProvider` (`app/providers.tsx`) hydrates `useSession()` from `GET /api/auth/session`, so the Go access JWT is JSON-visible to any XSS. Refresh stays on the httpOnly JWT (good). Client code only needs `status` / `error`.

Server `auth()` / BFF still need the token — strip it from the **client** session projection, keep it server-side.

### P1 — BFF drops `Idempotency-Key` (already **PR-003c**)

Confirmed still true. Do not re-ID.

| Caller | Sends header | BFF forwards |
| --- | --- | --- |
| `features/loyalty/api.ts` redeem | yes | **no** (`store` L64–70) |
| `features/wallet/api.ts` top-up | yes | **no** |
| `features/gift-cards/api/account.ts` purchase/redeem | yes | **no** |
| `wallet-credit-form.tsx` admin credit | yes | **no** (`admin` L92–109) |

Store/admin only set `Authorization` + `Content-Type`. Admin preserves multipart boundary (good).

### P1 — Store BFF has no `payments` first segment

`fe-commerce-account` mid is correct: after PR-005a ships a start URL, `/api/store/payments/…` will 403 `FORBIDDEN_PATH` unless `"payments"` is added to store `ALLOW`. Not part of PR-003c.

### P1 — `remotePatterns: hostname "**"` (5.18) — **FIXED PR-090c**

Allow-list is the configured media/API hostnames. See 5.18 above.

### P1 — Sentry / PostHog dead weight + no prod error sink (5.15)

Sentry: **removed** (PR-090d). PostHog: still installed, never initialized (PR-090e). `global-error` and route `error` boundaries still have no remote exception sink.

### P2 — robots / sitemap residuals

- Add `/checkout` (and optionally `/checkout/`) to `robots.ts` `disallow`. Layout already `noindex`. This lane owns robots/sitemap (not storefront page SEO).
- Add `/brands` to sitemap static routes (and tests).

### P2 — RTL close / English sr-only (6.13)

Logical `end-4`, `sr-only` «بستن». Same for sheet. DialogFooter «بستن».

### P2 — Dead deps + unused primitives (6.2)

See table. Also declare `@tiptap/extension-underline` + `@tiptap/extension-link`.

### P2 — `table.tsx` is still `"use client"`; recharts not code-split (5.17)

`components/ui/table.tsx` L1 `"use client"` — presentational only.  
`grep next/dynamic` over the frontend: **0 hits**. `features/admin/analytics/components/Charts.tsx` statically imports `recharts`. Admin-only blast radius.

### P2 — FE-facing nginx still 5.14

`infra/nginx/nginx.prod.conf`: no `server_tokens off`, no HSTS / X-Frame-Options / X-Content-Type-Options on `/api/v1` or `/media` (Next adds some of those on `/:path*` only — **nginx `/api/v1` and `/media` bypass Next**). TLS 443 block still commented. No `limit_req` on auth/OTP.

Next `headers()` already sets nosniff / SAMEORIGIN / Referrer-Policy / Permissions-Policy for the storefront. **No CSP, no HSTS** at either layer.

### P2 — Prod frontend `depends_on: backend: service_started` (5.13 residual)

`docker-compose.prod.yml` L195–196. Dev uses `service_healthy`. FE healthcheck hits `/` (full homepage), so a cold API can flap the FE healthcheck even after the process is up.

### P2 — `no-console` + emoji auth logs (6.19 residual)

### P2 — `lib/products.ts` still owns `faNum` / `formatPrice` (6.24)

Mock `Product` type remains in the same module imported by ~70 live files. Not a runtime bug; type/contract smell. Empty `lib/home/featured.ts` is leftover (6.11 is `fe-storefront`).

### P3 — Admin BFF `getLiveAccount` on every request

`app/api/admin/[...path]/route.ts` L62–84 calls live `/auth/me` per hop (plus staff role check). Correct for stale JWT roles; extra latency on every admin mutation/list.

### P3 — Public BFF method surface

`app/api/public/[...path]/route.ts` exports GET+POST for the whole allowlist, including `auth/otp/request` and password reset. Backend must own rate-limit. Path allowlist itself is tight (`auth/register`, password/*, otp/request, `categories/tree`, `settings`).

### P3 — Store BFF first-segment allowlist vs callers (today)

Store ALLOW covers every first segment used by `storeRequest` today (`cart`, `orders`, `addresses`, `coupons`, `shipping`, `wallet`, `wishlist`, `reviews`, `alerts`, `auth`, `loyalty`, `referrals`, `gift-cards`, `subscriptions`, `recommendations`, `me`). **1.2 `me` is fixed.**

Admin ALLOW first segment `admin` is an intentional catch-all for `/api/admin/admin/*`.

Path traversal on BFF is **tested** (`admin-proxy-path.test.ts` rejects `..` / double-encoding).

### Contracts that match

- Envelopes: `lib/api/types.ts` documents `{ data }` success vs top-level `{ results, pagination }`. `apiFetch` / `publicRequest` unwrap `.data ?? body`. `storeRequest` returns the body; domain APIs unwrap `.data` themselves.
- `lib/api/qs.ts` is isomorphic and not the npm `qs` package.
- `proxy.ts` tags `/account` and `/admin` with `X-Robots-Tag: noindex, nofollow` and does **not** decide role at the edge (layouts re-check `/auth/me`).
- Taste `me` allow-list: **fixed**. Admin mock `lib/admin/data.ts`: **gone** (docs mention only).

---

## Adjacent (other lanes — do not steal)

| Item | Owner |
| --- | --- |
| PR-003c Idempotency-Key | claimed |
| 6.11 home featured mocks, 5.20 multi-h1, 6.18 slug fallback, 6.1 wishlist heart | `fe-storefront` |
| 5.16 account overview no HydrationBoundary; checkout pay honesty | `fe-commerce-account` |
| Admin screen correctness | `fe-admin-ops` |
| JWT/RBAC/rate-limit/IDOR; AUTH_SECRET confirmation | `be-identity-security` |

**Ack `fe-commerce-account`:** store BFF missing `"payments"` is real; I propose **PR-040c** (add the segment when 005a exists). I am taking robots `/checkout` as this lane (robots/sitemap is in my brief).

---

## Proposed tasks (PR-040+)

Do **not** reuse PR-003c / PR-020 / PR-030.

| ID | Title | Lane | Sev | Effort | Why |
| --- | --- | --- | --- | --- | --- |
| **PR-040a** | Inject `AUTH_SECRET` + `AUTH_URL` (+ `trustHost`) into prod frontend | both | **P0** | S | Prod compose omits Auth.js secrets that dev already passes. |
| **PR-040b** | Stop putting `accessToken` on the client session | both | **P1** | S | `/api/auth/session` currently returns the Go bearer. |
| **PR-040c** | Allow-list `payments` on store BFF when PR-005a lands | fe | **P1** | S | Else start-URL fetch 403s `FORBIDDEN_PATH`. |
| **PR-041a** | Restrict `images.remotePatterns` (or remove if unused) | fe | **P1** | S | **Done as PR-090c.** Hosts from `NEXT_PUBLIC_MEDIA_BASE_URL` / `NEXT_PUBLIC_API_URL`. |
| **PR-041b** | Wire Sentry (instrumentation + `global-error`) **or** remove `@sentry/nextjs` | fe | **P1** | M | **Shipped as PR-090d** — removed unused SDK (no DSN). |
| **PR-041c** | Remove unused `posthog-js` (or initialize if product wants it) | fe | **P2** | S | Installed, never referenced. |
| **PR-042a** | Disallow `/checkout` in `robots.ts` | fe | **P2** | S | 6.12 residual. Page already `noindex`. |
| **PR-042b** | Add `/brands` to `sitemap.ts` + test | fe | **P2** | S | Public indexable route missing from sitemap. |
| **PR-043** | Dialog/Sheet close: logical `end-4` + «بستن» | fe | **P2** | S | 6.13 still `right-4` / English Close. |
| **PR-044** | Dead-dep + unused primitive sweep | fe | **P2** | M | 6.2. Include declare tiptap link/underline. |
| **PR-045** | `no-console` (allow `error`/`warn`) + drop emoji auth logs | fe | **P2** | S | 6.19 residual. Scripts already exist. |
| **PR-046** | Remove `"use client"` from `table.tsx`; `next/dynamic` admin charts | fe | **P2** | S–M | 5.17 still true. |
| **PR-047** | nginx FE-facing: `server_tokens off`, security headers on `/api/v1`+`/media`, optional `limit_req` on public auth | both | **P2** | M | 5.14 still true; Next headers never reach those locations. |
| **PR-048** | Prod FE `depends_on` backend healthy; healthcheck a cheap route | fe | **P2** | S | 5.13 residual. |

**Suggested implement order:** 040a → 040b → 003c (claimed) → 041a/b → 042a/b → 043 → 044 → 045 → 046 → 047 → 048 → 040c (with 005a).

**Non-goals / closed here:** 6.14 DataTable+reorder, skip-link, PWA 512 icons, coarse 44px buttons, `typecheck`/`test` scripts, taste `me` allow-list, admin mock data module.

---

## Questions left open (see BOARD mid)

1. Identity: confirm 040a omission + 040b session shape.  
2. Identity: admin BFF catch-all OK? Extra BFF headers beyond Idempotency-Key?  
3. Identity / catalog-content: concrete media hosts for 041a.  
4. Identity / ops: nginx `limit_req` on `/api/public/auth/*` wanted?

No application code changed.
