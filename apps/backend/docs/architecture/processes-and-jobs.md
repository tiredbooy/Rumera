# Processes and background jobs

**Who this is for:** operators and engineers who need to know *what binaries
exist* and *what runs inside the API process*.

> The API process also runs the **domain event worker** when
> `EVENTS_WORKER=embedded` (the default): it fans committed facts out to
> consumers, retries failures with backoff and dead-letters what cannot succeed.
> It is deliberately **not** a cron job — the cron runner wraps every job in a
> 30-minute timeout, which would kill a long-running consume loop. Started
> alongside the analytics queue and drained on shutdown before the DB pools
> close. See [domain-events.md](domain-events.md).
>
> Cron gained one job: `events_prune` (`CRON_EVENTS_PRUNE_SCHEDULE`, default
> 03:45 UTC) deletes fully-settled facts past `EVENTS_RETENTION`. Facts with a
> pending, retrying or dead-lettered consumption are kept regardless of age so
> they stay replayable.

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

Notifications: handlers and cron (alert check, box renewal) use
`notifications.Dispatcher` with `NOTIFICATIONS_MODE=inline` (default) or
`async` (outbox).

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

### 5. `event-worker` — domain-event consumers

```bash
EVENTS_WORKER=external go run ./cmd/event-worker
```

Runs the fan-out/consume loops (plus the Kafka relay and supervised ingest
consumer on `EVENTS_BUS=kafka`) with no HTTP server, cron or admin seeding.
Deploy it beside API replicas running `EVENTS_WORKER=external`, which then only
emit. Refuses to start on `EVENTS_ENABLED=false`. SIGTERM drains in-flight
handlers. See [domain-events.md](./domain-events.md).

---

## In-process cron (`internal/corn`)

Package path is historically spelled `corn` (means **cron**). Jobs are started
with the API process (schedules in config / bootstrap).

| Job file | Responsibility |
|----------|----------------|
| `stats_job.go` | Product stats rollups → analytics |
| `revenue_job.go` | Revenue aggregates |
| `search_job.go` | Search **analytics** summary (not Meili) |
| `meili_reindex_job.go` | Full Meili products rebuild when `MEILI_ENABLED` + client up (PH-030b; not storefront path) |
| `loyalty_birthday_job.go` | Cellar Club birthday awards (PH-040b; programme TZ, default Asia/Tehran) |
| `recommendation_job.go` | Rebuild recommendation inputs |
| `alert_check_job.go` | Back-in-stock / price-drop emails. **PR-055a:** prefers `notifications.Dispatcher.DispatchAlert` (outbox when `NOTIFICATIONS_MODE=async`, inline mail otherwise). Inline `mailer.Send` is the fallback when no dispatcher is wired. **PR-053a:** `notified_at` is stamped only after a successful dispatch/send. Dispatcher and mailer both unset logs and leaves the batch unnotified (retry next tick). A send error skips that id only — successes in the same tick are still marked. The job does not invent or skip emails. |
| `subscription_renewal_job.go` | Cellar-box due email + advance `next_renewal_at`. **PR-055a:** prefers `Dispatcher.DispatchSubscriptionRenewal` (idempotency `subscription:{id}:renewal:{YYYY-MM-DD}`). Inline `mailer.Send` is the fallback. **PR-057a:** date rolls only after a successful dispatch/send. Both unset logs and leaves the batch unadvanced (retry next tick). A send error skips that id only — successes in the same tick still roll. **No charge** ([box-subscriptions.md](./box-subscriptions.md)). |
| `idempotency_cleanup_job.go` | Prune `idempotency_keys` older than `IDEMPOTENCY_KEY_RETENTION` (default 30d); see [idempotency-runbook.md](./idempotency-runbook.md) |
| `reservation_ttl.go` | Unpaid reservation TTL (PR-020c). Pending orders older than **30 minutes** (`orders.ReservationTTL`) flip to `payment_failed` (not cancelled — customer may still pay via PR-020f), `ReleaseForOrder` + `GetStockLines`, and dangling `payment_transactions` `pending` → `failed`. **Coupon usage is not reversed** (`UsageRepository` has Record/Get only; leftover is PR-020j). Schedule is hardcoded `0 */5 * * * *` in `bootstrap/container.go` (no `CRON_*` env). Overlap-safe: CAS `pending` → `payment_failed` so only one tick releases. |
| `runner.go` | Scheduler wiring |

**Order earn sweeper (PR-003h, not a cron job):** leftover
`payment_loyalty_awards` rows (`awarded_at` NULL) are retried by
`payments.Service.ProcessPendingLoyaltyAwards` — Confirm calls it after
commit and it is exported for a later cron hook. Award is idempotent; do
not delete a failing row.

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

## Detached request-path work (PH-013a)

Some handlers schedule **fire-and-forget** side effects after returning a
response: OTP SMS, password-reset email, order confirmation email, blog read
counters, recipe view counters, analytics event push.

Those goroutines are **outside** Gin’s Recovery middleware. A panic there would
crash the process. Rule:

| Do | Don’t |
|----|--------|
| `pkg/async.Go` / `async.GoCtx` | Raw `go func()` for production side effects |
| Named task (`"auth.otp_sms"`) for logs | Anonymous panics with no label |
| Bound with `context.WithTimeout` via `GoCtx` | Inherit cancelled request context, or hang forever |
| Blog: keep bounded slots + async | Unbounded goroutine per page view |

`async.SetLogger` is wired once in `internal/bootstrap/app.go` so panics log
with stack traces. Long-lived workers (analytics queue Start, cron, HTTP
`ListenAndServe`) stay as structured process goroutines — not request fan-out.

---

## Suggested process topology

| Environment | Processes |
|-------------|-----------|
| Local dev | Compose: `backend` (server) + frontend + DBs; notifications often **inline** |
| Staging async | server (`NOTIFICATIONS_MODE=async`) + `notification-worker` + Redpanda/Kafka |
| Production | **one** `server` + `notification-worker` + `event-worker` + managed Postgres/Redis/Meili/Kafka — see the replica story below |

Do **not** run multiple seeders against production as a “sync” tool.

---

## The replica story (A-6)

**Decision: the API runs as a single `server` process.** The workers scale
independently; the API does not, and nothing in the code stops you from starting a
second one — it just misbehaves quietly. This section is the written-down version
of that, because the constraint was previously only implicit in the code.

Everything below was verified against the code, not assumed.

| Per-process state | Where | What a second replica does |
|---|---|---|
| **Cron scheduler** | `internal/corn/runner.go` — plain `robfig/cron`, **no advisory lock** | Every job fires once *per replica*. Most are idempotent by key (`alert_check` stamps `notified_at` after dispatch; birthday awards key on `{user,year}`; roll-ups upsert; reservation TTL uses a CAS), so this is duplicated work rather than duplicated effects — but nothing enforces that for the *next* job someone adds. |
| **Global rate limiter** | `pkg/middleware/ratelimit.go`, mounted in `bootstrap/setupMiddlewares.go` (100 req/s, burst 200) | A per-process token bucket. N replicas = N × the configured limit, and a client pinned to one replica by the load balancer sees a different limit than one that is round-robined. |
| **Analytics buffer** | `internal/analytics/queue.go` (10k events) | Per replica, which is fine — capacity multiplies and each process drains its own buffer on SIGTERM (P1-5). Not a blocker. |
| **Embedded event consumers** | `EVENTS_WORKER=embedded` (default) | Every replica joins the consumer group, so every rolling deploy triggers a rebalance and handler slots compete with checkout for the DB pool. This is exactly why production runs `EVENTS_WORKER=external` and `cmd/event-worker` (Q2 / K-9). |
| **Uploaded media** | local filesystem | Requires shared POSIX storage across processes — see [operations.md → Process topology](../operations.md). |
| **Next.js cache tags** | frontend | `updateTags`/`refreshTags` are process-local; replicas can serve different ISR generations after an admin write. |

Already shared, so **not** blockers: the auth/OTP throttle (Redis fixed window with
a per-process fallback, `internal/middlewares/ratelimit.go`), the read-through
cache (Redis), media reconciliation (globally locked in Postgres), and the event
outbox relay (`FOR UPDATE SKIP LOCKED`).

### Before running N > 1 `server` processes

1. `CRON_ENABLED=true` on **exactly one** process — or extract the jobs into their
   own binary. Never on all of them.
2. `EVENTS_WORKER=external` on every API replica; `cmd/event-worker` owns consumption.
3. Move the global limiter to the shared Redis counter the auth limiter already
   uses, or accept N × the limit and say so in the runbook.
4. Shared POSIX media storage, and a shared Next cache for the frontend.

Until all four hold, "server replicas" is a configuration that boots, serves
traffic and does the wrong thing without an error anywhere.
