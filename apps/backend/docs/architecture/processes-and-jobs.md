# Processes and background jobs

**Who this is for:** operators and engineers who need to know *what binaries
exist* and *what runs inside the API process*.

---

## Binaries (`cmd/`)

### 1. `server` — primary API

```bash
go run ./cmd/server
# or Docker service `backend`
```

Boots:

- Config + logger
- Main + analytics DB pools
- Redis, storage, SMS/mailer
- DI container (repositories → services → handlers)
- Analytics queue workers
- In-process **cron** runner (`internal/corn`)
- HTTP server with graceful shutdown

Notifications: handlers use `notifications.Dispatcher` with
`NOTIFICATIONS_MODE=inline` (default) or `async` (outbox).

---

### 2. `notification-worker` — async delivery

```bash
# modes: all | relay | consume | log
NOTIFICATION_WORKER_MODE=all go run ./cmd/notification-worker
```

| Mode | Behavior |
|------|----------|
| `all` | Outbox → Kafka **and** Kafka → providers (default when useful) |
| `relay` | Poll/claim outbox, publish to Kafka only |
| `consume` | Consume Kafka, deliver SMS/email, ledger idempotency |
| `log` | Heartbeat only (no brokers required) |

Requires main DB. Kafka brokers via `KAFKA_BROKERS`.  
Architecture: [notifications-kafka.md](./notifications-kafka.md) · local broker:
[`deploy/kafka/README.md`](../../deploy/kafka/README.md).

---

### 3. `seed` — demo data

```bash
make seed
# or
go run ./cmd/seed
```

- **Idempotent** natural keys (slug/code/title).
- Touches **main DB only**.
- Ordered FK-safe pipeline:

```
brands → categories → tags → products/variants/images/inventory
  → recipes → blogs → hero slides
```

Layout (split package `main`):

| File | Role |
|------|------|
| `main.go` | Entrypoint |
| `seeder.go` | Wiring + orchestration |
| `helpers.go` | Counts, lookups, parsePrice |
| `brands.go` … `hero.go` | Domain fixtures |

Safe to re-run. Does not replace migrations.

---

### 4. `media-reconcile` — orphan blob GC

```bash
go run ./cmd/media-reconcile              # dry-run
go run ./cmd/media-reconcile --apply      # delete
```

See [media-pipeline.md](./media-pipeline.md).

---

## In-process cron (`internal/corn`)

Package path is historically spelled `corn` (means **cron**). Jobs are started
with the API process (schedules in config / bootstrap).

| Job file | Responsibility |
|----------|----------------|
| `stats_job.go` | Product stats rollups → analytics |
| `revenue_job.go` | Revenue aggregates |
| `search_job.go` | Meilisearch product index sync |
| `recommendation_job.go` | Rebuild recommendation inputs |
| `alert_check_job.go` | Back-in-stock / price-drop emails |
| `subscription_renewal_job.go` | Subscription renewals |
| `idempotency_cleanup_job.go` | Prune old payment/webhook idempotency rows |
| `runner.go` | Scheduler wiring |

Jobs must be **safe to skip a tick** and **safe to overlap** where possible
(use DB constraints / idempotent upserts). Prefer logging + continue over
crashing the API.

Legacy notes: `docs/guides/cron-jobs-guide.txt` (may lag code — trust the Go
files when they disagree).

---

## Analytics queue (not cron)

Separate from cron: request middleware pushes events to a buffered channel;
worker goroutines batch-insert into the analytics DB. Drop-on-full, never block
HTTP. Documented in [architecture.md](../architecture.md).

---

## Suggested process topology

| Environment | Processes |
|-------------|-----------|
| Local dev | Compose: `backend` (server) + frontend + DBs; notifications often **inline** |
| Staging async | server (`NOTIFICATIONS_MODE=async`) + `notification-worker` + Redpanda/Kafka |
| Production | server replicas + worker replicas + managed Postgres/Redis/Meili/Kafka; optional separate cron only if you extract jobs later |

Do **not** run multiple seeders against production as a “sync” tool.
