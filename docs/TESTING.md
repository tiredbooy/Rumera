# Testing guide

**Who this is for:** anyone running or writing tests in the Rumera monorepo.

There is **no single monorepo test runner**. Backend and frontend are tested
separately. Playwright is a **dependency** for upcoming e2e (Task 062) but may
not yet have a checked-in suite.

---

## Quick matrix

| Layer | Command | Where |
|-------|---------|-------|
| Go unit + package tests | `go test ./...` | `apps/backend` |
| Go unit (make) | `make test-unit` | `apps/backend` |
| Go integration | `make test-integration` | `apps/backend` (needs DB URL) |
| Frontend unit / component | `npm test` / `npx vitest run` | `apps/frontend` |
| Frontend watch | `npm run test:watch` | `apps/frontend` |
| Typecheck | `npm exec tsc -- --noEmit` | `apps/frontend` |
| Lint | `npm run lint` | `apps/frontend` |
| Go vet | `go vet ./...` | `apps/backend` |
| Playwright e2e | `npm run test:e2e` | `apps/frontend` |

From **repo root** you typically `cd` into the app. Root `Makefile` is oriented
at Docker compose (`make dev`, `make seed`), not unit tests.

---

## Backend (Go)

### Unit / package tests (default)

```bash
cd apps/backend
go test ./...
# or
make test-unit
# verbose:
make test
```

These cover handlers (where present), services, repositories (SQL often with
fakes or careful unit style), mappers, notifications, middleware, pkg/*, and
cmd/seed helpers. **No Docker required** for the default suite.

Coverage:

```bash
make test-coverage   # if defined — see apps/backend/Makefile
# or
go test ./... -coverprofile=coverage.out -covermode=atomic
```

### Integration tests (tag-gated)

```bash
cd apps/backend
export TEST_DATABASE_URL='postgres://test:test@localhost:55432/rumera_test?sslmode=disable'
export TEST_REDIS_ADDR='localhost:56379'   # when a test needs Redis
make test-integration
# equivalent:
go test -tags=integration -count=1 ./tests/integration/...
```

Documented fully in [`apps/backend/tests/integration/README.md`](../apps/backend/tests/integration/README.md).

**Properties:**

- Build tag `integration` keeps them out of `go test ./...`.
- Uses **real Postgres** via `TEST_DATABASE_URL`; skips cleanly if unset.
- Applies **goose migrations** from `migrations/main` in `TestMain`.
- Focus areas: inventory reservation, coupons under concurrency, media pipeline,
  products/tags, gift cards, shipping, hero constraints, refresh cache scripts,
  admin user lifecycle, etc.

**Do not** point integration tests at a shared dev database with important data.

### What to unit-test vs integrate

| Prefer unit | Prefer integration |
|-------------|-------------------|
| Pure mappers, validators, envelope helpers | Inventory reserve/deduct/release |
| Notification dispatcher with memory fakes | Coupon usage limits under load |
| Handler binding with mocked services | Media ownership + locks |
| Cron aggregate SQL can be unit-tested with care | Full migration round-trips |

### Critical pure paths (PH-013c) — local, no CI

These packages have focused unit coverage for money/auth safety. Run anytime:

```bash
cd apps/backend
go test ./pkg/token/ ./internal/middlewares/ ./pkg/middleware/ ./internal/features/payments/ -count=1
```

| Area | Package / file | What it guards |
|------|----------------|----------------|
| JWT purpose + expiry + wrong secret | `pkg/token` (`jwt_test.go`) | Access vs refresh, expired, tampered, empty |
| Auth rehydrate ban/inactive/role | `internal/middlewares` (`auth_test.go`) | Live role beats stale claim |
| RequirePermission residual | `internal/middlewares` (`permission_test.go`) | Admin superuser, staff grant/deny, checker error → 500, empty perms |
| Idempotency store | `pkg/middleware` (`idempotency_test.go`) | Replay once, body conflict, inflight, stale reclaim, concurrent winner |
| Webhook fail → release | `internal/features/payments` (`webhook_test.go`) | Failed payment releases reserved stock once; terminal replay no double-release |
| Webhook HMAC + terminal ACK | same | Signature reject; succeeded/failed replay ACK |

Still **no CI** — local `go test` only (founder decision). Integration money paths stay under `//go:build integration`.

### Notifications / Kafka

Package tests under `internal/notifications` use in-memory fakes. They do **not**
require a live broker. Live Redpanda is for manual/ops verification
(`deploy/kafka/`).

---

## Frontend (Vitest)

### Config

`apps/frontend/vitest.config.ts`:

- Alias `@` → app root
- Default environment: **`node`** (many pure function tests)
- Component tests that need DOM use Testing Library; some files rely on
  environment overrides if added later

### Commands

```bash
cd apps/frontend
npm test                 # vitest run --passWithNoTests
npx vitest run path/to/file.test.ts
npm run test:watch
npm exec tsc -- --noEmit
npm run lint
```

### Conventions

| Kind | Location examples |
|------|-------------------|
| Pure domain logic | `features/**/*.test.ts`, `lib/**/*.test.ts` |
| Components | `*.test.tsx` next to component |
| Routing / presentation | `list-routing.test.ts`, `catalogue-presentation.test.ts` |
| Admin validations | `features/admin/**/validations.test.ts` |

**Patterns that already work well:**

- Catalogue truthfulness (`catalogue-presentation`)
- Recipe commerce linking (`commerce.test.ts`)
- Media URL resolution (`lib/media/*.test.ts`)
- Admin revalidation plans (`lib/admin-revalidation.test.ts`)
- Checkout state machine (`checkout-state.test.tsx`)
- JSON-LD / brand / PWA config

**ProcessEnv in tests:** do not `delete` read-only `process.env` keys; pass
explicit `env` objects into pure functions or snapshot-restore env carefully
(see media + jsonld tests).

### What Vitest is not

- Not a substitute for **real browser** keyboard/axe checks (Playwright).
- Not full Next.js route e2e (RSC + middleware). Use Playwright for that.

---

## Playwright (e2e / a11y) — Task 062

| Item | Detail |
|------|--------|
| Config | `apps/frontend/playwright.config.ts` |
| Specs | `apps/frontend/e2e/**/*.spec.ts` |
| Axe | `@axe-core/playwright` via `e2e/helpers/a11y.ts` (critical/serious only) |
| Command | `cd apps/frontend && npm run test:e2e` |
| Base URL | `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`) |
| Age gate | storageState + `rumera:age-verified`; prefer **localhost** not `127.0.0.1` in Next 16 |

### Spec map

| File | Covers |
|------|--------|
| `a11y.storefront.spec.ts` | axe on home/products/categories/search/recipes/journal/tags/cart/offline/login |
| `keyboard.spec.ts` | skip link, tab to nav, age-gate confirm, search submit |
| `responsive.spec.ts` | no horizontal overflow @ 320px |
| `storefront-routes.spec.ts` | Group 056 shells + search empty + media smoke |
| `lifecycle.spec.ts` | 404 recovery, offline, history back |
| `checkout.spec.ts` | guest gate / empty cart / no hard crash |
| `admin-auth-gate.spec.ts` | `/admin` requires auth |

### Prerequisites

- Frontend up (`make dev` or `npm run dev`).
- Optional: live API for product images (media smoke skips when catalogue empty).
- Chromium installed via Playwright (`npx playwright install chromium` once).

---

## Suggested pre-merge gate (local)

```bash
# Backend
cd apps/backend && go test ./... && go vet ./...

# Frontend
cd apps/frontend && npm exec tsc -- --noEmit && npm test && npm run lint
```

Optional: `npm run build` (API offline is soft-failed on public SSG surfaces;
money paths still need a live API for meaningful QA).

Optional integration:

```bash
cd apps/backend && make test-integration   # with TEST_DATABASE_URL set
```

---

## Writing new tests (checklist)

1. **Name the behavior**, not the implementation (`reserves stock with order`).
2. Prefer **fakes at the repository boundary** for service unit tests.
3. For money/stock, add or extend **integration** tests.
4. Frontend: keep wire types honest — assert on real JSON field names.
5. RTL UI: prefer role/label queries over brittle CSS selectors.
6. Do not snapshot entire pages for tiny logic changes.
7. Update this guide if you introduce a new runner (e.g. Playwright script).

---

## Related docs

- [Docs hub](./README.md)
- [System overview](./SYSTEM-OVERVIEW.md)
- [Documentation map](./DOCUMENTATION-MAP.md)
- Backend [processes & jobs](../apps/backend/docs/architecture/processes-and-jobs.md)
- Backend [inventory](../apps/backend/docs/architecture/inventory.md) (integration-tested)
- Frontend [domain map](../apps/frontend/docs/features/domain-map.md)
