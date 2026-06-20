# Rumera

> رومرا — a Persian (Farsi, right-to-left) luxury wine, champagne & spirits
> e-commerce platform.

Rumera is a full-stack storefront with a warm "candle-lit cellar" design
language: a Go API serving a Next.js 16 storefront and admin console, backed by
PostgreSQL/TimescaleDB, Redis and Meilisearch. The whole stack boots with **one
command**.

| | |
|---|---|
| **Backend** | Go 1.25 · Gin · pgx/v5 · PostgreSQL + TimescaleDB · Redis · Meilisearch · JWT |
| **Frontend** | Next.js 16 (App Router, Turbopack) · React 19 · TanStack Query · shadcn/ui · Tailwind 4 · next-auth v5 |
| **Orchestration** | Docker Compose (dev + prod) · nginx gateway · `Makefile` |
| **Locale** | Farsi, RTL-first; Persian numerals via `faNum()`, prices via `formatPrice()` |

---

## Repository layout

```
Rumera/
├── apps/
│   ├── backend/                 # Go API (Gin, pgx/v5, goose migrations)
│   │   ├── cmd/server/          # main entrypoint
│   │   ├── cmd/seed/            # idempotent Persian test-data seeder
│   │   ├── internal/            # handlers → services → repositories → models
│   │   │   ├── bootstrap/       # dependency injection / wiring
│   │   │   ├── routes/          # route registration (public/customer/admin)
│   │   │   ├── middlewares/     # recovery, request-id, auth, rate-limit, …
│   │   │   └── analytics/ corn/ # analytics + scheduled jobs
│   │   ├── pkg/                 # apperr, database, cache, token, media, …
│   │   ├── migrations/main/     # goose SQL migrations
│   │   ├── configs/config.go    # env-driven config (full var list)
│   │   └── docs/                # backend documentation (start here)
│   └── frontend/               # Next.js 16 storefront + admin console
│       ├── app/
│       │   ├── (storefront)/   # public store      ─┐ route groups add
│       │   ├── (account)/      # customer dashboard  │ NO URL segment
│       │   ├── (auth)/         # sign-in / register ─┘
│       │   ├── admin/          # admin console (RBAC-gated)
│       │   └── api/{admin,store,public,auth}/[...path]/  # BFF proxies
│       ├── lib/                # api clients, rbac/, site.ts, helpers
│       ├── components/         # ui/ primitives + brand components
│       └── docs/               # frontend documentation
├── docs/                       # cross-cutting docs (Docker, roadmap, …)
├── infra/nginx/                # dev + prod reverse-proxy configs
├── docker-compose.dev.yml      # dev stack (Compose Watch hot reload)
├── docker-compose.prod.yml     # prod stack (hardened, non-root, fail-fast)
├── .env.dev.example            # dev env template (sensible defaults)
├── .env.prod.example           # prod env template ([REQUIRED] secrets)
└── Makefile                    # make dev / prod / seed / health / …
```

> The repo has **two apps** under `apps/` — there is no shared package
> workspace; the frontend talks to the backend over HTTP.

---

## Architecture at a glance

```
                ┌──────────────────────────────────────────────────┐
 browser ─────► │  nginx gateway  (:80)                             │
                │     /api/v1/* → backend   /* → frontend (+ HMR)   │
                │        │                                          │
                │        ├─► frontend  (Next.js 16, :3000)          │
                │        │      server-side fetches → backend       │
                │        └─► backend   (Go API, :8080)              │
                │               ├── postgres      (main DB, :5432)  │
                │               ├── analytics_db  (TSDB,    :5433)  │
                │               ├── redis         (cache,   :6379)  │
                │               └── meilisearch   (search,  :7700)  │
                └──────────────────────────────────────────────────┘
                          all on the internal `rumera_network`
```

The backend is **layered** (`handlers → services → repositories → models`) with
DI in `internal/bootstrap`; errors flow through `pkg/apperr`. The frontend uses
**BFF proxies** (`app/api/{admin,store,public}/[...path]`) so the browser never
holds API credentials. See the per-app docs below for the full picture.

---

## Quickstart

**Prerequisites:** Docker + Docker Compose v2.22+ (for Compose Watch). Nothing
else — Go and Node run *inside* the containers.

```bash
# 1. Create env files from the committed templates (first run only;
#    `make dev` does this for you automatically).
make env

# 2. Start the full dev stack with hot reload for BOTH apps.
make dev

# 3. (optional, in another terminal) seed realistic Persian storefront data.
make seed

# 4. Check everything is up.
make health
```

That's it. `make dev` auto-creates `.env.dev` from `.env.dev.example`, builds
the images, and runs **Docker Compose Watch** so edits to `apps/frontend/**`
(Next.js Fast Refresh) and `apps/backend/**` (Air rebuild) reload live.
**Migrations run automatically on backend boot** — no manual migrate step in dev.

### Dev URLs & ports

| Service | URL / port | Notes |
|---------|-----------|-------|
| **Gateway** (single origin) | http://localhost:80 → `/healthz` | nginx; `/api/v1/*`→backend, `/*`→frontend |
| **Storefront** | http://localhost:3000 | Next.js, also reachable via the gateway |
| **Backend API** | http://localhost:8080 | base; health at `/health`, API under `/api/v1` |
| Postgres (main) | `localhost:5432` | `timescale/timescaledb:latest-pg17` |
| Analytics DB | `localhost:5433` | TimescaleDB |
| Redis | `localhost:6379` | `redis:8-alpine` |
| Meilisearch | `localhost:7700` | `getmeili/meilisearch:v1.15` |

Override any host port via env, e.g. `FRONTEND_PORT=3001 make dev`.

> **Health endpoints.** The backend serves `GET /health`
> (`internal/routes/routes.go:21`), returning `{"data":{"status":"ok"}}`. The
> gateway serves `GET /healthz`. Note: the `make health` target currently curls
> the backend at `/api/v1/health` — the canonical backend probe is `/health`.

---

## Make targets

Run `make help` for the full, self-documenting list. The essentials:

| Target | What it does |
|--------|--------------|
| `make env` | Create `.env.dev` + `.env.prod` from templates (if missing) |
| `make dev` | Start the dev stack with Compose Watch (hot reload) |
| `make dev-up` | Start the dev stack detached (no watch) |
| `make dev-down` | Stop the dev stack |
| `make dev-logs` *(`SVC=backend`)* | Tail logs (optionally one service) |
| `make dev-nuke` | Stop dev **and wipe volumes** (destroys the DB) |
| `make seed` | Run `go run ./cmd/seed` in the backend — idempotent, safe to re-run |
| `make health` | Curl gateway / backend / frontend health |
| `make db-shell` | `psql` into the dev main database |
| `make backend-shell` / `frontend-shell` | Shell into a running container |
| `make prod` / `prod-up` / `prod-down` | Production stack lifecycle |
| `make prod-config` | Validate & render the resolved prod compose config |

> Database migrations are **not** in the root Makefile. In dev the backend
> auto-migrates on boot; for manual control use the backend's own
> `apps/backend/Makefile` (`make migrate-all-up`, `make migrate-status`).

---

## Production

```bash
cp .env.prod.example .env.prod   # then EDIT the [REQUIRED] secrets
make prod                        # build + start optimized images, detached
```

The prod stack uses tiny multi-stage images (Next.js `output: "standalone"`;
a static, stripped Go binary), runs as **non-root**, and **fails fast** if a
required secret is missing (`${VAR:?...}` guards). Datastores are **not**
published to the host — they live only on the internal network. The API binds
to `127.0.0.1` by default (`BACKEND_BIND`); put a TLS-terminating reverse proxy
in front. Full details in [`docs/DOCKER.md`](docs/DOCKER.md).

---

## Documentation

| Doc | Covers |
|-----|--------|
| [`apps/backend/docs/`](apps/backend/docs/README.md) | API architecture, getting started, conventions, auth, operations, full API reference |
| [`apps/frontend/docs/`](apps/frontend/docs/) | Storefront/admin structure, App Router patterns, BFF proxies, RBAC, design system |
| [`apps/frontend/AGENTS.md`](apps/frontend/AGENTS.md) | **Next.js 16 gotchas** — async `params`/`searchParams`, route groups add no URL segment |
| [`docs/DOCKER.md`](docs/DOCKER.md) | Dev vs prod stacks, Compose Watch, service map, troubleshooting |
| [`docs/FEATURE-ROADMAP.md`](docs/FEATURE-ROADMAP.md) | Planned features |
| [`docs/IMPROVEMENT-OPPORTUNITIES.md`](docs/IMPROVEMENT-OPPORTUNITIES.md) | Monorepo-wide improvement backlog (epics, prioritized) |

> **Next.js 16 note:** this is a recent major version. `params` and
> `searchParams` are **async** (you must `await` them), and route groups
> (`(storefront)`, `(account)`, `(auth)`) add **no** URL segment. Verify
> behavior against `apps/frontend/AGENTS.md` and the docs bundled at
> `apps/frontend/node_modules/next/dist/docs/01-app`, not from memory.

---

## Git workflow

Active development happens on the **`dev`** branch (the current checked-out
branch); `main` is the stable/default branch. Branch off `dev`, push to
`origin/dev`, and open PRs from there.

---

## Environment files

| File | Purpose |
|------|---------|
| `.env.dev.example` | Dev template — every value has a sensible default, so a fresh clone runs with zero edits |
| `.env.prod.example` | Prod template — fill in the `[REQUIRED]` secrets before deploying |
| `.env.example` | Annotated reference of all variables (see `docs/DOCKER.md`) |

`make env` copies the dev/prod templates into `.env.dev` / `.env.prod` (both
git-ignored). The full backend variable list lives in
[`apps/backend/configs/config.go`](apps/backend/configs/config.go).
