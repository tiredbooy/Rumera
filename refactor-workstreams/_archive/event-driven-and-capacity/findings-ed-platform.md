# Findings — `ed-platform`

**Agent:** ed-platform  
**Workstream:** `event-driven-capacity-20260816`  
**Date:** 2026-08-16  
**Mode:** plan only (no application code)

Design the **event platform**: generic domain outbox, CloudEvents-like envelope,
relay (poll first; Kafka optional), consumer worker, idempotency, DLQ, tracing,
and how cron jobs become consumers or stay cron.

**Hard constraint:** the default path must work **without Kafka**. Kafka is a
later scale task (ED-007). Money stays in explicit transactions; events notify.

---

## What I inspected

| Area | Paths |
|------|--------|
| Charter / board | `refactor-workstreams/event-driven-and-capacity/CHARTER.md`, `BOARD.md` |
| Notify architecture | `apps/backend/docs/architecture/notifications-kafka.md` |
| Processes / jobs | `apps/backend/docs/architecture/processes-and-jobs.md` |
| ADR | `obsidian/11 Decisions/ADR Outbox Kafka notifications.md` |
| Notifications code | `apps/backend/internal/notifications/` (`event.go`, `outbox.go`, `dispatcher.go`, `handler.go`, `memory.go`, `postgres/store.go`, `kafka/*`) |
| Worker | `apps/backend/cmd/notification-worker/main.go` |
| Schema | `apps/backend/migrations/main/20260804120000_notification_outbox.sql` |
| Wire | `internal/bootstrap/container.go` (`buildNotifications`, `buildCron`) |
| Cron | `internal/corn/*.go` |
| Side-effect producers | `payments/service.go` Confirm, `orders/receipt.go`, `giftcard/service.go`, `auth/otp.go`, `analytics/queue.go` |
| Idempotency (HTTP) | `docs/architecture/idempotency.md` (PH-011) — **do not reuse** as the event ledger |
| Tracing | `pkg/tracing/tracing.go`, `span.go`; Confirm already has a span |
| Roadmap leftover | `apps/backend/docs/roadmap.md` B5 generic outbox (still `DEFERRED`) |

---

## Already built (do not reinvent)

Charter inventory is accurate. Reuse these shapes; do not start a second bus.

| Piece | What it is | Limit |
|-------|------------|--------|
| `notification_outbox` | Command outbox: “send this SMS/email” | Kafka-shaped (`topic`, `partition_key`); pool enqueue, not TX |
| CloudEvents-ish `Envelope` | `specversion`, `id`, `type`, `source`, `time`, `datacontenttype`, `data`, `rumera.{correlation_id,idempotency_key,attempt}` | Notification types only; no `subject`, `traceparent`, `causation_id` |
| `Relay` + `Publisher` | Poll → publish → `published_at` | Poll has **no** `FOR UPDATE SKIP LOCKED` (comment lies) |
| `notification-worker` | `all` / `relay` / `consume` / `log` | `relay|consume|all` **fatal without `KAFKA_BROKERS`**; `log` is a heartbeat |
| `notification_deliveries` | Consumer idempotency PK | `TryBegin` inserts **before** send (see bug below) |
| Kafka DLQ | Poison → `*.dlq` then commit | Kafka-only; no Postgres DLQ |
| HTTP idempotency | `idempotency_keys` (PH-011) | Request/webhook replay, not event consumption |
| Loyalty earn intent | `payment_loyalty_awards` + `ProcessPendingLoyaltyAwards` | Domain-specific sweeper, not a bus |
| Analytics queue | In-memory channel → Timescale | Drop-on-full; not durable |
| OTel | Provider + otelgin + otelpgx | Almost no app spans; envelope does not carry `traceparent` |
| Cron | In-process `internal/corn` (`CRON_ENABLED`) | Comment mentions a dedicated worker; **no cron binary exists** |

Docs say “same TX when possible”. **No `EnqueueTx` exists.**  
`postgres.Store.Enqueue` uses `*pgxpool.Pool` only.

---

## Verdict: new `domain_events`, keep `notification_outbox`

**Do not widen `notification_outbox` into the generic bus.**

| | `notification_outbox` | `domain_events` (new) |
|--|----------------------|------------------------|
| Kind | **Command** — deliver SMS/email | **Fact** — “order was paid” |
| Written by | `Dispatcher` | Domain service **inside the money/catalog TX** |
| Consumers | One delivery handler | N independent consumers |
| Key | `otp:…`, `order:42:confirm` | `order.paid:42`, `product.updated:99` |
| Transport today | Outbox → Kafka required | Must default to **Postgres poll** |

Notification commands stay useful: OTP and password-reset are not domain facts
worth fanning out. Money/catalog/engagement lanes emit **facts**; a later
notification consumer may call `Dispatcher` (ED-010+ / ED-030+, not this lane).

Roadmap **B5** (`outbox` + `corn/outbox_job.go` to drive inventory reserve) is
**superseded**. Inventory reserve stays in the checkout TX (charter: events are
not the ledger). B5’s useful idea is the **durable fact + poller**, which this
platform is.

---

## Target architecture (local-first)

```
HTTP / domain service
        │
        │ 1. Business TX: domain rows + domain_events row (same Postgres TX)
        ▼
  domain_events                    notification_outbox (commands, unchanged role)
        │                                    │
        │ 2a. Default: poll / SKIP LOCKED    │ 2b. Default: same poller, no Kafka
        │     (relay is a no-op copy)        │     claim → DeliveryHandler
        ▼                                    ▼
  consumer worker (single process is enough)
        │
        │ 3. Per-consumer ledger + retry + Postgres DLQ
        ▼
  handlers (notify, search, recs, analytics, loyalty retry, cache bust)
        │
        │ 4. Optional later: Relay Publisher = Kafka
        ▼
  Kafka topics + remote consumer groups
```

**Customer API stays HTTP + JSON.** Next.js never speaks Kafka.

### Envelope (CloudEvents 1.0 subset + Rumera)

Lift `notifications.Envelope` into `internal/events` (notifications keep a
thin alias or embed). Wire JSON:

```json
{
  "specversion": "1.0",
  "id": "uuid",
  "type": "order.paid.v1",
  "source": "rumera/api",
  "subject": "order:42",
  "time": "2026-08-16T12:00:00Z",
  "datacontenttype": "application/json",
  "data": { "order_id": 42, "user_id": 7, "amount": "120000" },
  "rumera": {
    "correlation_id": "req-or-trace-id",
    "causation_id": "",
    "idempotency_key": "order.paid:42",
    "attempt": 1,
    "traceparent": "00-…-…-01"
  }
}
```

Rules:

- `id` = unique produce id (new UUID per insert; not the business key).
- `type` = `{aggregate}.{verb}.vN` — bump suffix on breaking payload changes.
- `subject` = `{aggregate}:{id}` for humans and partition key fallback.
- `idempotency_key` = stable business key; **unique on the outbox**.
- `data` is a **small fact**, not an email HTML body. No provider PII unless
  the consumer is notifications (then use the command outbox).
- Partition / claim order key = `subject` (or explicit `partition_key`).

Notification envelopes stay as they are (`notification.otp.v1`, …).

### Schema (proposed)

```text
domain_events (
  id               BIGSERIAL PRIMARY KEY,
  event_id         UUID NOT NULL,              -- envelope.id
  type             TEXT NOT NULL,
  source           TEXT NOT NULL,
  subject          TEXT NOT NULL,
  partition_key    TEXT NOT NULL,
  specversion      TEXT NOT NULL DEFAULT '1.0',
  time             TIMESTAMPTZ NOT NULL,
  datacontenttype  TEXT NOT NULL DEFAULT 'application/json',
  data             JSONB NOT NULL,
  correlation_id   TEXT,
  causation_id     TEXT,
  traceparent      TEXT,
  idempotency_key  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- relay-to-Kafka only; local consumers ignore this
  published_at     TIMESTAMPTZ,
  publish_error    TEXT
)
UNIQUE (idempotency_key)
INDEX unpublished (created_at) WHERE published_at IS NULL
INDEX by_type_time (type, created_at)

domain_event_consumptions (
  event_pk         BIGINT NOT NULL REFERENCES domain_events(id),
  consumer         TEXT NOT NULL,              -- e.g. notify.order_paid
  status           TEXT NOT NULL,              -- pending | done | retry | dlq
  attempts         INT NOT NULL DEFAULT 0,
  available_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error       TEXT,
  event_id         UUID NOT NULL,
  processed_at     TIMESTAMPTZ,
  PRIMARY KEY (event_pk, consumer)
)
INDEX due (status, available_at) WHERE status IN ('pending','retry')

domain_event_dlq (
  id               BIGSERIAL PRIMARY KEY,
  event_pk         BIGINT NOT NULL,
  consumer         TEXT NOT NULL,
  envelope         JSONB NOT NULL,
  error            TEXT NOT NULL,
  attempts         INT NOT NULL,
  dead_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at      TIMESTAMPTZ
)
```

Fan-out: on insert (or first poll of a new row), the worker ensures one
consumption row per **registered** consumer that matches `type`. Matching is
in-process registry, not SQL subscriptions.

### Same-TX enqueue (mandatory)

```text
events.Publisher.EnqueueTx(ctx, tx pgx.Tx, env)  -- ON CONFLICT (idempotency_key) DO NOTHING
```

Call sites in other lanes (not this agent) pass the **open** money/catalog TX.
Pool-only enqueue is allowed only for facts that have no domain TX (rare).

Notification store needs the same `EnqueueTx` (ED-005). Today gift-card
fulfill calls `DispatchGiftPurchased` **inside** `FulfillPaidPurchaseTx` while
the outbox write hits a **second connection**. Rollback of Confirm leaves a
ghost outbox row (or the inverse: commit without the command if enqueue
fails after commit on other paths).

### Relay and bus modes

| `EVENTS_BUS` | Relay | Consumer |
|--------------|-------|----------|
| **`postgres` (default)** | Optional wake (`NOTIFY` later). Poll is source of truth. `published_at` unused until Kafka. | Worker `SELECT … FOR UPDATE SKIP LOCKED` on due consumptions |
| `kafka` | Poll unpublished → produce envelope → `published_at` | Kafka group + same consumption ledger (or notification_deliveries for SMS/email) |

`NOTIFY`/`LISTEN` is an optimization, not a requirement. Poll interval ~1–2s
matches the existing notification relay ticker.

**Do not** publish to Kafka inside the domain TX.

### Worker topology

Prefer **one** `cmd/event-worker` (or a mode on `notification-worker`) that
loads modules: notifications + domain consumers.

| Mode | Behavior | Brokers? |
|------|----------|----------|
| `local` **(default)** | Poll `domain_events` + `notification_outbox`; run handlers | No |
| `relay` | Outbox → Kafka only | Yes |
| `consume` | Kafka → handlers | Yes |
| `all` | Relay + consume | Yes |
| `embedded` | Same as `local`, started from `cmd/server` when `EVENTS_WORKER=embedded` | No |

Local / staging-without-Redpanda: `server` + `event-worker` (`local`) + main
Postgres. Inline notifications remain the zero-ops OTP path.

`CRON_ENABLED=false` already lets API replicas skip jobs; a future extract of
cron into this worker is optional (ED-006), not a blocker.

### Idempotency (do not copy the notification bug)

`DeliveryHandler.Handle` inserts `notification_deliveries` **then** sends.
On send error it returns `done=false` (retry). The next attempt sees the row
and **skips send** (`done=true`). At-least-once becomes **at-most-never** after
the first provider failure.

**Policy for the generic ledger (and a fix for notifications):**

| Step | Rule |
|------|------|
| Delivery | At-least-once |
| Claim | `pending` + `SKIP LOCKED`; increment `attempts` |
| Success | `status=done`, `processed_at=now()` |
| Retryable fail | `status=retry`, `available_at = now() + exp backoff`, keep `last_error` |
| Permanent / max attempts (default 8) | Copy to `domain_event_dlq`, `status=dlq` |
| Duplicate event insert | `ON CONFLICT (idempotency_key) DO NOTHING` |
| Duplicate consume | `done` row → no-op |
| HTTP `idempotency_keys` | **Out of band** — never shared |

Insert-before-side-effect is only safe if the row stays `pending` until success
(and retries reclaim `pending`/`retry`, not `done`).

Replay: operator sets `replayed_at`, resets consumption to `pending`, **same**
`idempotency_key`. Intentional resend uses a new key.

### Tracing and metrics

Reuse `pkg/tracing`. Envelope carries `rumera.traceparent` + `correlation_id`
from the request (`X-Request-ID` / OTel context). Worker extracts and starts
child spans:

- `events.enqueue`
- `events.claim`
- `events.consume.{consumer}`
- `events.dlq`
- existing `payments.Confirm` remains the parent on money paths

Metrics (docs already named notification counters; **none are implemented**):

- `event_enqueued_total{type}`
- `event_consumed_total{consumer,result}`
- `event_retry_total{consumer}`
- `event_dlq_total{consumer}`
- `event_outbox_lag_seconds` (oldest due `available_at`)
- plus the documented `notification_*` counters on the notify module

Logs: `event_id`, `type`, `consumer`, `idempotency_key`, `correlation_id`.

### What must not go on the bus

- Reserve / deduct / refund / wallet debit / coupon consume — stay in the TX
  that already does them (`payments.Confirm` is the model).
- Analytics clickstream — keep the in-memory queue (lossy is accepted). Optional
  later: a consumer for **business** analytics (`order.paid`), not page views.
- FE live updates — out of scope (ED-040+).

---

## Cron: become a consumer, stay cron, or both

**Rule:** calendar / catch-up / retention stays **cron**. Reaction to a
committed fact becomes a **consumer**. Keep a sweeper when the consumer can
miss (crash between commit and enqueue is impossible if enqueue is in the TX;
handler failure is the ledger + DLQ).

| Job | Decision | Why |
|-----|----------|-----|
| `stats_job` | **Stay cron** | Periodic Timescale rollup |
| `revenue_job` | **Stay cron** | Periodic aggregate |
| `search_job` | **Stay cron** | Search **analytics** summary, not Meili |
| `meili_reindex_job` | **Stay cron** (full rebuild) + **consumer** later (`product.changed.v1`) | Cron is the safety net / cold start (PH-030b). Incremental index is ED-020+ |
| `loyalty_birthday_job` | **Stay cron** | Calendar in programme TZ |
| `recommendation_job` | **Stay cron** (profile rebuild) + **consumer** later (`order.paid` → `RecordPurchasesForOrder`) | Confirm already calls recs post-commit, best-effort. ED-030+ |
| `alert_check_job` | **Stay cron sweeper**; optional consumer on stock/price facts | Condition scan; Dispatcher already used (PR-055a) |
| `subscription_renewal_job` | **Stay cron** | Due-date scan; no charge |
| `idempotency_cleanup_job` | **Stay cron** | Retention of HTTP keys |
| `reservation_ttl` | **Stay cron** | TTL sweep; CAS is already overlap-safe. Delayed events are optional later, not required |
| `ProcessPendingLoyaltyAwards` | **Stay sweeper** (should be **registered cron**) + **consumer** on `order.paid.v1` | Intent row is the idempotent hook (PR-003h). Confirm already retries once. ED-010 / ED-030 |
| OTP / password-reset / paid receipt / gift email | **Stay Dispatcher** (command outbox). Receipt/recs become consumers of `order.paid` later | Do not wait on domain bus to send OTP |

`async.Go` request-path work (OTP, receipt, blog reads) stays `pkg/async` until
the relevant fact/command is in an outbox **in the same durability boundary**.
OTP is Redis-backed; command outbox after `SET` is enough (not a domain event).

---

## Gaps that block a safe default (evidence)

1. **Async notifications require Kafka.** Worker `log.Fatal` without brokers.
   Local default for durability should be Postgres poll + deliver.
2. **Outbox is not in the domain TX.** Pool `Exec`; gift fulfill notifies
   inside `tx` on another connection (`giftcard/service.go` `notifyPurchased`).
   Receipt is **post-commit** `async.GoCtx` — crash loses the email.
3. **`ClaimUnpublished` does not lock.** Two relays can publish the same row.
   Docs and `Relay` comment require `FOR UPDATE SKIP LOCKED`.
4. **Insert-before-send** on `notification_deliveries` drops retries.
5. **No generic fact stream.** Confirm already does money+stock+earn intent in
   one TX, then best-effort recs + receipt. That is the first producer for
   `order.paid.v1` (**ED-010**, not ED-00x).
6. **Documented notification metrics do not exist** in `pkg/metrics`.
7. **Envelope has no trace context.** OTel will not stitch worker work to HTTP.
8. **No Postgres DLQ / replay** for a no-Kafka world.

---

## Seams for other lanes (do not implement here)

| Lane | First facts (suggested) | Consumer examples |
|------|-------------------------|-------------------|
| `ed-money` | `order.paid.v1`, `order.payment_failed.v1`, `reservation.expired.v1` | Receipt, loyalty earn retry, recs purchase, coupon leftover later |
| `ed-catalog` | `product.changed.v1`, `variant.stock.changed.v1` | Meili incremental, cache stamp, alert sweeper wake |
| `ed-engagement` | consume `order.paid`; maybe `review.created.v1` | Loyalty, recs, review side effects |
| `ed-frontend` | none | HTTP stays source of truth; eventual consistency already in list/detail |
| `k6-suite` | — | Optional outbox-lag scenario after ED-002 |

Platform ships **registry + one log/no-op consumer** so the loop is testable
without those lanes.

---

## Proposed tasks (ED-000–ED-009)

Lane: `ed-platform`. Effort: S ≤½ day · M 1–3 days · L multi-day.

### ED-000 — Envelope + `internal/events` contracts · **S** · P1

- New package: CloudEvents 1.0 subset + `rumera` extensions (see JSON above).
- `NewEnvelope`, validate `type` + `idempotency_key`, JSON round-trip tests.
- Type catalog as constants; unknown types are allowed for forward consumers
  but producers must register.
- Notifications keep working: either alias the struct or share a tiny
  `events.Envelope` value type. **No Kafka. No migration.**

### ED-001 — `domain_events` schema + TX enqueue · **M** · P0

- Goose migration for `domain_events` (unique `idempotency_key`, unpublished
  index). Consumptions + DLQ can land here or with ED-003; prefer **same
  migration** so the worker is not half-wired.
- `Store.EnqueueTx(ctx, tx, env)` and pool helper for tests.
- `ON CONFLICT DO NOTHING` = success.
- Unit tests with `pgx.Tx` fake or integration test: rollback of domain TX
  rolls back the event; commit makes it visible.
- **Do not** write `order.paid` from payments yet.

### ED-002 — Local poll bus + worker (no Kafka) · **M** · P0

- `Publisher` port (already exists conceptually on notifications).
- `cmd/event-worker` **or** `NOTIFICATION_WORKER_MODE`/`EVENT_WORKER_MODE=local`
  that does **not** require `KAFKA_BROKERS`.
- Poll 1–2s, batch claim, graceful SIGINT (finish in-flight).
- Optional `EVENTS_WORKER=embedded` on `cmd/server` for single-binary dev.
- Env: `EVENTS_BUS=postgres` default. Document in processes-and-jobs.
- In-process `Memory*` fakes stay for unit tests.

### ED-003 — Consumer registry, retry, Postgres DLQ · **M** · P0

- Registry: `events.Register(name, types[]string, Handle)`.
- Claim due consumptions with `FOR UPDATE SKIP LOCKED`.
- Status machine + exp backoff + max 8 + `domain_event_dlq`.
- **Never** mark `done` before handler success.
- Replay helper (func + small command or documented SQL) using the same key.
- Tests: success once, retry then success, poison → DLQ, duplicate event
  insert, two consumers independent.

### ED-004 — Tracing + metrics · **S** · P2

- Put `traceparent` + `correlation_id` on enqueue; extract in worker.
- Spans listed above via `pkg/tracing.Start`.
- Prometheus counters/gauges (event + the documented notification names).
- Structured logs. No new vendor.

### ED-005 — Notification path: local deliver + TX + lock + ledger fix · **M** · P0

Independent of ED-001; can ship in parallel.

- `ClaimUnpublished`: `FOR UPDATE SKIP LOCKED` in a short TX (match the
  comment on `Relay`).
- `EnqueueTx` on `notification_outbox`; Dispatcher accepts optional `tx`.
- **`NOTIFICATIONS_BUS=postgres` (default when async):** worker claims outbox
  and runs `DeliveryHandler` — **Kafka not required**.
- `NOTIFICATIONS_BUS=kafka` preserves today’s relay/consume.
- Fix `TryBegin`: pending vs done (or delete-on-failure). Add a test where
  the first send fails and the second send **happens**.
- Stop treating `log` mode as the only no-broker worker.

### ED-006 — Cron taxonomy + sweeper hook · **S** · P2

- Dual-doc the table in this file into `processes-and-jobs.md` + Obsidian
  Processes and Jobs (stay vs consumer vs both).
- Register `ProcessPendingLoyaltyAwards` as a real cron (it is exported and
  documented as “later cron hook” — still not in `buildCron`).
- Optional interface `events.CronJob` is unnecessary; do not extract a cron
  binary unless replicas need it. `CRON_ENABLED=false` is enough.
- No job rewrites that belong to ED-010 / ED-020 / ED-030.

### ED-007 — Kafka publisher/consumer adapter (optional scale) · **M** · P2

**Blocked on ED-002 + ED-003.** Reuse `internal/notifications/kafka`.

- Topic = `rumera.{type}` (dots as-is) or a single `rumera.domain.v1` with
  type in the envelope — prefer **per-type topics** only when a consumer
  group must scale alone; start with **one** `rumera.domain.v1` + `*.dlq` to
  avoid topic sprawl. Notifications keep their two topics.
- `EVENTS_BUS=kafka` flips relay on. Default stays postgres.
- Dual-write to Kafka inside the domain TX remains **forbidden**.
- Local compose already exists (`deploy/kafka`). Do not make CI require it.

### ED-008 — Golden-path harness + ops inspect · **M** · P1

- Integration test: open TX → insert dummy `test.ping.v1` → commit → worker
  `RunOnce` → consumer saw it once → second `RunOnce` no-op.
- Failure test → DLQ → replay → done.
- Read-only inspect: SQL views or a tiny admin/debug listing of unpublished /
  `retry` / DLQ (staff-only if HTTP; CLI/SQL is enough for v1).
- k6 does **not** belong here.

### ED-009 — ADR + dual-doc · **S** · P2

- New ADR: “Domain outbox (Postgres-first); Kafka optional; notifications
  remain a command outbox.” Point at existing notify ADR.
- Update `notifications-kafka.md` (local bus, ledger fix, SKIP LOCKED).
- Update `processes-and-jobs.md` (binaries, modes, cron table).
- `docs/SYSTEM-OVERVIEW.md` Kafka sentence: optional, not the default bus.
- Glossary: `Term outbox` today says notifications only — add domain outbox.
- Journey: domain event (alongside Journey Notification async).

---

## Suggested claim order

```
ED-000
  ├─ ED-001 ─┬─ ED-002 ─ ED-003 ─┬─ ED-007
  │          │                   └─ ED-008
  │          └─ ED-004 (after 002 exists)
  ├─ ED-005  (parallel)
  └─ ED-006  (docs; sweeper register)
ED-009 last (or incremental with each ship)
```

**Definition of done for the platform (before ED-010+ producers):**

- A service can `EnqueueTx` a fact in the same TX as a domain write.
- A single worker delivers that fact to two consumers, exactly-once
  **effect**, at-least-once **delivery**, with DLQ, **with Kafka down**.
- Async notifications can be durable the same way.
- Kafka remains a config flip, not a dependency.

---

## Non-goals (this lane)

- Event sourcing, CQRS, microservices, checkout sagas on the bus
- Implementing `order.paid` / Meili incremental / loyalty consumers
- Changing Next.js or BFF
- Replacing Timescale analytics queue
- WebSocket / live admin (ED-040+)
