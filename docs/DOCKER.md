# Rumera — Docker & Local Orchestration

One command brings up the **entire** Rumera stack — PostgreSQL, an analytics
TimescaleDB, Redis, Meilisearch, the Go API and the Next.js storefront — with
hot reload for both apps in development and hardened, optimized images in
production.

| Stack | File | Use it for |
|-------|------|-----------|
| **Development** | [`docker-compose.dev.yml`](../docker-compose.dev.yml) | Local work with live reload (Compose Watch) |
| **Production** | [`docker-compose.prod.yml`](../docker-compose.prod.yml) | Optimized, minimal, non-root images |

> Convenience wrapper: a root [`Makefile`](../Makefile) exposes `make dev`,
> `make prod`, etc. Run `make help` for the full list.

---

## TL;DR

```bash
# 1. (optional for dev, required for prod) create your env file
cp .env.example .env

# 2a. DEVELOPMENT — start everything with live hot-reload
docker compose -f docker-compose.dev.yml up --build --watch
#    → storefront  http://localhost:3000
#    → API         http://localhost:8080/health

# 2b. PRODUCTION — build + run optimized images in the background
docker compose --env-file .env -f docker-compose.prod.yml up --build -d
```

Or with the Makefile:

```bash
make dev          # dev stack + watch
make prod         # prod stack, detached
make dev-down     # stop dev
make prod-down    # stop prod
```

---

## Development stack — live reload everywhere

```bash
docker compose -f docker-compose.dev.yml up --build --watch
```

The `--watch` flag enables **[Docker Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/)**.
Compose monitors the source tree on the host and reacts to changes
automatically — no bind-mount fiddling, no manual restarts:

| You change… | Compose does… | Result |
|-------------|---------------|--------|
| `apps/frontend/**` (`.tsx`, `.ts`, css, …) | **sync** into the container | Next.js **Fast Refresh** updates the browser instantly |
| `apps/backend/**` (`.go`, templates) | **sync** into the container | **Air** rebuilds & restarts the API in ~1s |
| `apps/frontend/package.json` / lockfile | **rebuild** the image | Dependencies reinstalled cleanly |
| `apps/backend/go.mod` / `go.sum` | **rebuild** the image | Modules re-downloaded cleanly |

`node_modules`, `.next`, `tmp/` and test files are excluded from sync, so the
container's installed dependencies are never clobbered by the host.

**Why it boots with zero config:** every value in `docker-compose.dev.yml` has a
sensible default (`${VAR:-default}`), so a fresh clone runs immediately. Create a
`.env` only to override something.

What you get in dev:

- **Ports published to the host:** storefront `3000`, API `8080`, Postgres
  `5432`, analytics DB `5433`, Redis `6379`, Meilisearch `7700` — handy for
  connecting local tools (psql, RedisInsight, …).
- **Persistent volumes** for every datastore plus Go module/build caches, so
  restarts are fast and data survives.
- **Healthcheck-gated startup:** the API waits until Postgres, the analytics DB,
  Redis and Meilisearch all report healthy before it boots.

Common commands:

```bash
docker compose -f docker-compose.dev.yml logs -f backend   # tail one service
docker compose -f docker-compose.dev.yml ps                # status
docker compose -f docker-compose.dev.yml down              # stop
docker compose -f docker-compose.dev.yml down -v           # stop + wipe data
```

---

## Production stack — small, secure, reliable

```bash
cp .env.example .env        # then fill in real secrets
docker compose --env-file .env -f docker-compose.prod.yml up --build -d
```

Designed for real deployment:

- **Tiny multi-stage images.**
  - *Frontend:* Next.js `output: "standalone"` — the runtime image carries only
    the traced server bundle + static assets, **not** the full `node_modules` or
    any source. Starts via `node server.js`.
  - *Backend:* a statically linked (`CGO_ENABLED=0`), stripped Go binary on a
    minimal Alpine base — no toolchain, no source.
- **Non-root containers.** Both apps run as unprivileged users.
- **Built-in healthchecks.** Frontend probes `/`, backend probes `/health`;
  Docker restarts unhealthy containers.
- **Fail-fast configuration.** Required secrets use `${VAR:?...}`, so the stack
  refuses to start (with a clear message) if a secret is missing — no silently
  insecure boots.
- **Databases are not exposed to the host.** They're reachable only on the
  internal `rumera_network`. The API binds to `127.0.0.1` by default; the
  storefront is published. Put a TLS-terminating reverse proxy (nginx, Caddy,
  Traefik) in front.
- **Log rotation** (`json-file`, 10 MB × 5) and **resource limits** on every
  service for predictable behaviour under load.
- **Hardened Redis:** password-protected, `appendonly` persistence, an LRU
  `maxmemory` policy.

### Required production environment

These must be set in `.env` or the stack won't start:

`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `ANALYTICS_DB_USER`, `ANALYTICS_DB_PASSWORD`,
`ANALYTICS_DB_NAME`, `REDIS_PASSWORD`, `MEILI_API_KEY`, `JWT_SECRET`,
`CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`.

See [`.env.example`](../.env.example) for the full annotated list.

> **Note on `NEXT_PUBLIC_SITE_URL`:** it is *inlined into the frontend build*
> (used for canonical/OG tags, `sitemap.xml`, `robots.txt`). It's passed as a
> build arg, so rebuild the frontend image when you change it.

### Database migrations

The compose files do **not** run migrations automatically. Apply them with the
backend's tooling (see `apps/backend/Makefile`), e.g.:

```bash
docker compose -f docker-compose.prod.yml exec backend ./server   # if your boot runs them
# or run goose migrations from the backend Makefile against the DB
```

---

## Service map

```
                 ┌──────────────────────────────────────────────┐
 browser ─────►  │  frontend  (Next.js, :3000)                   │
                 │     │ server-side fetches → backend            │
                 │     ▼                                          │
                 │  backend   (Go API, :8080)                     │
                 │     ├── postgres      (main DB,  :5432)        │
                 │     ├── analytics_db  (TimescaleDB, :5433 dev) │
                 │     ├── redis         (cache,   :6379)         │
                 │     └── meilisearch   (search,  :7700)         │
                 └──────────────────────────────────────────────┘
                       all on the internal `rumera_network`
```

(Datastore host ports are published in **dev only**.)

---

## Files reference

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Dev stack with Compose Watch hot reload |
| `docker-compose.prod.yml` | Optimized, hardened production stack |
| `.env.example` | Annotated environment template |
| `Makefile` | `make dev` / `make prod` shortcuts |
| `apps/frontend/Dockerfile` | Frontend **prod** image (standalone, non-root) |
| `apps/frontend/Dockerfile.dev` | Frontend **dev** image (`next dev`) |
| `apps/backend/Dockerfile` | Backend **prod** image (static binary, non-root) |
| `apps/backend/Dockerfile.dev` | Backend **dev** image (Air hot reload) |

---

## Troubleshooting

- **Watch isn't reloading** — ensure you passed `--watch` (or ran `make dev`),
  and that you're on Compose v2.22+ (`docker compose version`). On some
  filesystems file events are unreliable; the frontend dev image sets
  `WATCHPACK_POLLING=true` to compensate.
- **Port already in use** — override the host port, e.g.
  `FRONTEND_PORT=3001 docker compose -f docker-compose.dev.yml up`.
- **Prod refuses to start citing a variable** — that secret is missing from
  `.env`; the `:?` guard is intentional. Add it and retry.
- **Frontend can't reach the API from the browser** — `NEXT_PUBLIC_API_URL`
  must be a URL the *browser* can resolve (e.g. `http://localhost:8080` in dev),
  not the internal `http://backend:8080` (that's for server-side calls).
