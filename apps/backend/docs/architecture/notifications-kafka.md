# Notifications architecture — Kafka worker (Task 061j)

## Why Kafka (evidence-based)

| Current mechanism | Limitation |
|-------------------|------------|
| Inline `pkg/sms` / `pkg/notify` from HTTP handlers | Couples request latency to provider RTT; failures only log |
| No durable queue | Process crash after commit loses “send email” side effect |
| No consumer isolation | Cannot scale OTP vs order-email traffic independently |

Kafka gives **durable, ordered (per key) async delivery**, **consumer groups**, and a clear **DLQ** path without inventing a second database bus. We still **do not publish inside the same DB transaction without an outbox** — dual-write is forbidden.

## Current producers (inventory)

| Producer | Channel | Dispatch (implemented) | Event type |
|----------|---------|------------------------|------------|
| `handlers/auth_otp.go` | SMS OTP | `Dispatcher.DispatchOTP` | `notification.otp.v1` |
| `PasswordResetService` | Email | `Dispatcher.DispatchPasswordReset` | `notification.password_reset.v1` |
| `handlers/order.go` `sendOrderConfirmation` | Email | `Dispatcher.DispatchOrderConfirmed` | `notification.order_confirmed.v1` |

**Easy local default:** `NOTIFICATIONS_MODE=inline` + `SMS_PROVIDER=log` — OTP codes appear in API logs, no Kafka.  
**Async:** `NOTIFICATIONS_MODE=async` + `KAFKA_BROKERS=…` + `make notification-worker` (see cutover section / `deploy/kafka/README.md`).

Providers stay behind interfaces (`pkg/sms`, `pkg/notify`) — the worker calls them; HTTP enqueues when async.

## High-level flow

```
HTTP / domain service
        │
        │ 1. Business TX: write domain rows + outbox row (same Postgres TX)
        ▼
  notification_outbox
        │
        │ 2. Outbox publisher (poll / LISTEN) — at-least-once to Kafka
        ▼
  Kafka topics (partition key = user_id or phone)
        │
        │ 3. notification-worker consumer group
        ▼
  Idempotency store (notification_deliveries)
        │
        ▼
  sms.Sender / notify.Mailer  →  provider
        │
        │ on permanent failure after N retries
        ▼
  topic *.dlq + metrics/log
```

## Topics

| Topic | Key | Value (JSON) | Notes |
|-------|-----|--------------|--------|
| `rumera.notification.otp.v1` | `phone` | OTP payload | High priority, short retention OK |
| `rumera.notification.email.v1` | `user_id` | template + vars | password reset, order confirm |
| `rumera.notification.otp.v1.dlq` | same | original + error | Manual replay |
| `rumera.notification.email.v1.dlq` | same | original + error | Manual replay |

**Retention:** 7d default; DLQ 30d. **Partitions:** 3 in dev, scale with consumer count in prod.

## Event envelope (versioned)

```json
{
  "specversion": "1.0",
  "id": "uuid",
  "type": "notification.order_confirmed.v1",
  "source": "rumera/api",
  "time": "2026-08-04T12:00:00Z",
  "datacontenttype": "application/json",
  "data": { "...channel-specific..." },
  "rumera": {
    "correlation_id": "req-or-trace-id",
    "idempotency_key": "order:42:confirm",
    "attempt": 1
  }
}
```

- **`id`**: unique per produce attempt (Kafka message).
- **`idempotency_key`**: stable business key; consumer skips if already delivered.

## Outbox table (atomicity)

```sql
notification_outbox (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  publish_error TEXT
);
-- unique (idempotency_key) prevents duplicate enqueue
```

Publisher loop: `SELECT … FOR UPDATE SKIP LOCKED` → produce → mark `published_at`.

## Consumer guarantees

| Concern | Policy |
|---------|--------|
| Delivery | At-least-once |
| Ordering | Per partition key only |
| Idempotency | `notification_deliveries(idempotency_key PRIMARY KEY)` insert-before-send or unique on success |
| Retry | Exponential backoff in worker (not Kafka rebalance thrash); max 8 attempts |
| DLQ | After max attempts, produce to `*.dlq`, commit offset |
| Shutdown | Context cancel → finish in-flight → commit |

## Ownership

| Component | Package / binary |
|-----------|------------------|
| Event types + validation | `internal/notifications` |
| Outbox repo | `internal/notifications/outbox` |
| Kafka producer/consumer adapters | `internal/notifications/kafka` |
| Worker main | `cmd/notification-worker` |
| SMS / email | `pkg/sms`, `pkg/notify` (unchanged contracts) |

## Local Docker

```bash
# From apps/backend/deploy/kafka
docker compose -f docker-compose.kafka.yml up -d
# Brokers: localhost:9092
# Create topics via init container or worker --bootstrap
```

Env (worker + API publisher):

```
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=rumera-api
NOTIFICATION_WORKER_GROUP=rumera-notification-worker
```

## Observability

- Metrics: `notification_published_total`, `notification_delivered_total`, `notification_failed_total`, `notification_dlq_total`, consumer lag (exporter tools).
- Logs: structured with `correlation_id`, `idempotency_key`, `topic`.
- Traces: propagate `correlation_id` from HTTP middleware into outbox payload.

## Replay

1. Inspect DLQ message in Kafka UI / console consumer.
2. Fix root cause (template, provider, data).
3. Re-publish to main topic with **same** `idempotency_key` only if delivery never succeeded; otherwise new key for intentional resend.

## Security

- No PII in topic names; payload may contain email/phone — encrypt at rest on brokers in prod, TLS to cluster.
- Worker credentials least-privilege; no public Kafka ports in prod.

## Migration path from inline send

1. Dual-write: outbox + keep inline send behind feature flag (optional).
2. Worker consumes and sends; disable inline path.
3. Delete direct handler calls to SMS/email for those events.

## Code map (this task)

See package docs under `internal/notifications/` and `cmd/notification-worker`.

## Cutover (implemented)

### Config

| Env | Meaning |
|-----|---------|
| `NOTIFICATIONS_MODE=inline` | Default. API dispatches via `pkg/sms` / `pkg/notify` immediately. |
| `NOTIFICATIONS_MODE=async` | API enqueues `notification_outbox` only; worker publishes + delivers. |
| `KAFKA_BROKERS` | Comma-separated brokers (e.g. `localhost:19092` for Redpanda compose). |
| `NOTIFICATION_WORKER_GROUP` | Consumer group (default `rumera-notification-worker`). |

### Producers (API)

| Call site | Dispatch |
|-----------|----------|
| `handlers.RequestOTP` | `Dispatcher.DispatchOTP` |
| `PasswordResetService.RequestReset` | `Dispatcher.DispatchPasswordReset` via `WithNotifier` |
| `handlers.sendOrderConfirmation` | `Dispatcher.DispatchOrderConfirmed` |

### Worker

```bash
# Terminal 1 — broker
cd apps/backend/deploy/kafka && docker compose -f docker-compose.kafka.yml up -d

# Terminal 2 — API (async)
export NOTIFICATIONS_MODE=async
export KAFKA_BROKERS=localhost:19092
# …existing DB env…
go run ./cmd/server   # or your usual make target

# Terminal 3 — worker (relay outbox → Kafka + consume → SMS/email)
export NOTIFICATIONS_MODE=async
export KAFKA_BROKERS=localhost:19092
export NOTIFICATION_WORKER_MODE=all
go run ./cmd/notification-worker
```

### Packages

| Path | Role |
|------|------|
| `internal/notifications` | Envelope, dispatcher, relay, delivery handler |
| `internal/notifications/postgres` | Outbox + deliveries stores |
| `internal/notifications/kafka` | segmentio/kafka-go publisher + consumer |
| `cmd/notification-worker` | Process entry (`all` / `relay` / `consume` / `log`) |
| `migrations/main/*_notification_outbox.sql` | Schema |

### Guarantees in this cutover

- **At-least-once** produce and consume.
- **Idempotent delivery** via `notification_deliveries.idempotency_key`.
- **No dual-write to Kafka inside DB TX** — only outbox row in-process; relay is separate.
- **Poison messages** committed after optional DLQ publish when handler returns `done=true` with error.
