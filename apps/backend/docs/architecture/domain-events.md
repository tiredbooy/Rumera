# Domain events (transactional outbox)

> Flipping `EVENTS_BUS` to `kafka`? Follow
> [kafka-cutover-runbook.md](./kafka-cutover-runbook.md) — the backfill in step 3
> is not optional.

Paid-order side effects run as **idempotent consumers of a committed fact**
instead of as fire-and-forget work on the checkout request path.

The customer API stays HTTP + JSON. Browsers and Next.js are not event clients.
Money paths — reserve, deduct, wallet debit, refund — stay explicit SQL in their
own transaction. **Events notify; they are never the ledger.**

---

## Why an outbox and not a direct publish

A service that commits a payment and *then* publishes loses the message on any
crash in between. One that publishes first announces a payment that may roll
back. Neither is acceptable for money.

So the fact is written to `domain_events` **inside the same Postgres
transaction** as the money. It commits with the payment or it does not exist.
A separate worker moves it onward.

```
POST /orders (wallet)         POST /webhooks/payment → Confirm
        │                                  │
        └────────────┬─────────────────────┘
                     ▼
       ┌─────────────────────────────────┐
       │ ONE transaction                 │
       │  • debit / mark paid / deduct   │
       │  • INSERT domain_events         │  ← same TX, so they cannot disagree
       └─────────────────────────────────┘
                     │ COMMIT
                     ▼
              domain_events
                     │
       ┌─────────────┴──────────────┐
       │                            │
  EVENTS_BUS=postgres         EVENTS_BUS=kafka
  worker polls directly       relay → rumera.domain.v1 → consumer group
       │                            │
       └─────────────┬──────────────┘
                     ▼
        domain_event_consumptions          ← one row per (fact, consumer)
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     receipt     loyalty +      recs
      email      referral      purchase
```

Each consumer has its **own** ledger row, retry budget and dead-letter state, so
a broken receipt mailer cannot stop loyalty from awarding.

## Facts are not commands

Two outboxes exist on purpose. They are not merged.

| | `domain_events` | `notification_outbox` |
|---|---|---|
| Content | A **fact**: "order 42 was paid" | A **command**: "send this email" |
| Written by | A domain service, inside its transaction | The notification dispatcher |
| Consumers | N independent, each with its own ledger row | One delivery handler |
| Failure of one consumer | Does not affect the others | Is the whole delivery |

A consumer of a fact may well *issue* a command — the receipt consumer does
exactly that. The reverse never happens.

---

## Transport

`EVENTS_BUS=postgres` (default) — the worker polls `domain_events` directly.
No broker, so dev, CI and production all work with zero extra infrastructure.

`EVENTS_BUS=kafka` — a relay publishes each fact to `rumera.domain.v1`, keyed by
subject (`order:42`) so all facts about one order land on one partition and stay
ordered. A consumer group reads them back.

**Consumers are identical in both modes.** The Kafka consumer does not run
handlers inline; it only writes the consumption ledger rows and commits the
offset. The consume loop then runs the handlers. That split is what stops one
slow consumer from blocking the partition for everyone else, and stops a Kafka
retry from re-running consumers that already succeeded.

Before switching to Kafka: the broker compose file is a separate, opt-in stack on
its own docker network — see the header of `deploy/kafka/docker-compose.kafka.yml`
for how to join it to the app network. `KAFKA_BROKERS` must be set or the app
refuses to boot (rather than silently never relaying).

---

## Delivery guarantees

**At-least-once delivery, exactly-once effect.**

Producer-side, the idempotency key is `order:{id}:paid` — keyed on the **order**,
not the payment. That is what makes a replayed webhook, a double Confirm, and
the two payment rails collapse to a single fact.

### The claim is a lease, and that is load-bearing

`ClaimDue` does not merely `SELECT ... FOR UPDATE SKIP LOCKED`; it also pushes
`available_at` forward by a visibility timeout (handler timeout + 30s).

The lock alone is **not** mutual exclusion. The claim is a single autocommit
statement, so its row locks are released the moment it returns — microseconds
later, long before the handler finishes. Without the lease, the next consume
loop one second later re-claims the same row and runs the handler *concurrently
with itself*: two receipt emails, two award attempts, and the retry budget
burned on a handler that never actually failed. With `EVENTS_CONCURRENCY=4` by
default, that is four loops racing, times however many replicas run.

The lease also makes a crash self-healing: a worker that dies mid-handler leaves
its rows invisible only until the lease expires, after which they are runnable
again with no operator intervention.

### Settle transitions are terminal

`MarkDone` / `MarkRetry` / `MarkDLQ` only act on a row still in `pending` or
`retry`. A straggler — a duplicate claim, a slow attempt finishing after a
faster one — therefore cannot move a settled row backwards and cause the handler
to run again.

### Consumers still need their own guard

The ledger makes the common case exactly-once. It is not sufficient on its own:
a crash between "side effect done" and "row marked done" re-runs the handler. So
every consumer also leans on a domain guard:

| Consumer | What actually makes it safe to run twice |
|---|---|
| `order_paid.loyalty` | Loyalty ledger `UNIQUE (reason, ref_type, ref_id)` |
| `order_paid.recs` | Idempotent per `(order_id, UTC day)` |
| `order_paid.receipt` | Delivery ledger keyed `order:{id}:confirm` |

The receipt guard applies in **both** notification modes. Async mode dedupes on
the outbox's unique key; inline mode previously computed that key and threw it
away, so a retrying consumer would have emailed the buyer again. Inline sends
now go through the same claim/confirm ledger (`Dispatcher.sendOnce`).

### Consumers must not detach

A consumer runs on the background worker, which already provides the retry
budget. A handler that hands work to a goroutine and returns `nil` — as
`SendPaidOrderReceipt` does — would have the row marked done before the side
effect was handed off, making the durability guarantee a lie. That is why the
receipt consumer calls `SendPaidOrderReceiptNow`, the synchronous variant that
returns the real delivery error.

### Awards re-check the order

The loyalty award is no longer in-request, so a refund can overtake it: the
clawback runs before any points exist, finds nothing to reverse, and the award
lands afterwards on a refunded order. `LoyaltyConsumer` re-reads the order
status (`IsOrderStillPaid`) and settles without awarding when it is no longer
paid-like.

## Retry and dead-lettering

| Outcome | What happens |
|---|---|
| Handler returns nil | `status=done` |
| Handler returns an error | `status=retry`, `available_at = now + backoff`, error recorded |
| Handler returns `events.Permanent(err)` | Straight to `status=dlq` — no retry budget burned |
| Handler panics | Recovered and treated as permanent |
| Attempts exceed `EVENTS_MAX_ATTEMPTS` | `status=dlq` |

Backoff is `base × 2^(attempt-1)`, capped at `EVENTS_BACKOFF_MAX`, plus up to 20%
jitter. The jitter matters: without it every parked row retries in the same
instant when a shared dependency recovers, and knocks it straight over again.

Classify a failure as permanent when retrying it cannot possibly help — a
malformed payload, an unknown type, a provider that is not configured.
Everything else is transient.

**A third class exists on the notification path**, because "the database is
down" is neither. Two sentinels in `internal/notifications` steer the Kafka
consumer:

| Sentinel | Meaning | Consumer behaviour |
|---|---|---|
| `ErrRetryIndefinitely` | Infrastructure is down, the message is fine | Never dead-letters; keeps retrying until the dependency returns |
| `ErrDeliveredUnconfirmed` | The send happened, only the ledger write failed | Commits (a retry would re-send) but never dead-letters |

The second matters more than it looks: dead-lettering there would copy the
envelope — which for an OTP contains the **plaintext code** — onto the DLQ
topic, where a later bulk replay would text it again.

The first matters in Kafka mode specifically. `KafkaIngestHandler` writing the
consumption ledger is the *only* thing that ever causes a relayed fact to be
consumed, so letting a transient DB outage exhaust into the DLQ would lose the
fact outright.

---

## Operating it

### Metrics

| Metric | Meaning |
|---|---|
| `event_outbox_lag_seconds` | Age of the oldest due, unprocessed consumption. **Alert on this.** |
| `event_relay_lag_seconds` | Age of the oldest fact not yet published to Kafka. **Alert on this too** — see below. 0 on the postgres bus. |
| `event_dlq_total{consumer,type}` | Dead-lettered consumptions. **Any increase needs a human.** |
| `event_ledger_depth{status}` | Rows by pending/retry/done/dlq |
| `event_ingest_up` | 1 while the Kafka ingest consumer is running. **Alert on 0.** |
| `event_ingest_restarts_total` | Ingest restarts after a fatal error. Sustained growth = crash-looping. |
| `event_consumed_total{consumer,type,result}` | Handler outcomes |
| `event_consume_duration_seconds{consumer}` | Handler latency |
| `event_retry_total`, `event_enqueued_total`, `event_published_total` | Throughput |

Sustained lag growth means consumers are behind or the worker is not running.

**Why two lag gauges.** `event_outbox_lag_seconds` is derived from consumption
rows. In Kafka mode those rows are created when the broker delivers a fact back —
so with the broker down **no consumption rows exist at all** and the gauge reads 0
during exactly the total-ingest failure it was added to catch.
`event_relay_lag_seconds` is measured relay-side, off `domain_events.published_at`,
so it is the one that climbs when the broker is unreachable. Alert on both: outbox
lag catches slow or stuck consumers, relay lag catches a broker that is gone.
A DLQ increase means something is broken in a way retrying will not fix.

### Inspecting

```sql
-- what is stuck right now
SELECT consumer, type, status, attempts, last_error, available_at
FROM domain_event_consumptions
WHERE status IN ('retry', 'dlq')
ORDER BY created_at DESC
LIMIT 50;

-- lag
SELECT NOW() - MIN(available_at) AS lag
FROM domain_event_consumptions
WHERE status IN ('pending','retry') AND available_at <= NOW();
```

`domain_events.data` holds user ids and amounts. Treat any inspect surface as
staff-only and redact the payload by default.

### Replaying

Fix the cause first, then revive the dead-lettered rows. Replay keeps the same
idempotency key, so a handler that already had an effect stays protected by its
own domain guard.

```sql
UPDATE domain_event_consumptions
SET status = 'pending', available_at = NOW(), attempts = 0, processed_at = NULL
WHERE status = 'dlq' AND consumer = 'order_paid.receipt';
```

`events.Store.Replay(ctx, consumer, limit)` does the same thing from code.

### Retention

The `events_prune` cron job deletes facts older than `EVENTS_RETENTION`
(default 30 days) **only when every consumption is `done`**. Anything pending,
retrying or dead-lettered is kept regardless of age, so a failure stays
replayable after you fix it.

### Turning it off

`EVENTS_ENABLED=false` reverts to the legacy in-request side effects. The same
flag gates producers and consumers, so exactly one path is ever live and nothing
is awarded twice. Facts already in the table are simply not consumed until it is
turned back on.

There is deliberately **no** half-on state. `EVENTS_ENABLED=true` with
`EVENTS_WORKER=off` is rejected at boot: the producers would have stood the
legacy side effects down while nothing consumed the facts, so receipts, loyalty
and recommendation signals would stop entirely and silently.

`external` is the other supported shape: the API replicas only emit and
`cmd/event-worker` runs the loops in its own process (`event-worker` service in
`docker-compose.prod.yml`, same image, `./event-worker` entrypoint). It boots the
same dependency graph as the API — no HTTP server, cron or admin seeding — and
claims the worker explicitly rather than reading `EVENTS_WORKER`, so it can never
start and consume nothing. It refuses to start on `EVENTS_ENABLED=false`.

### Config reference

| Env | Default | Notes |
|---|---|---|
| `EVENTS_ENABLED` | `true` | Master switch / rollback |
| `EVENTS_BUS` | `postgres` | `kafka` also requires `KAFKA_BROKERS` |
| `EVENTS_WORKER` | `embedded` | `external` = `cmd/event-worker` owns the loops; `off` rejected while enabled |
| `EVENTS_CONSUMER_GROUP` | `rumera-event-worker` | Kafka only |
| `EVENTS_CONCURRENCY` | `4` | Handlers at once; each holds a pool conn |
| `EVENTS_FANOUT_INTERVAL` / `_BATCH` | `1s` / `100` | |
| `EVENTS_CONSUME_INTERVAL` / `_BATCH` | `1s` / `50` | |
| `EVENTS_RELAY_INTERVAL` / `_BATCH` | `1s` / `100` | Kafka only |
| `EVENTS_MAX_ATTEMPTS` | `8` | Then dead-letter |
| `EVENTS_BACKOFF_BASE` / `_MAX` | `2s` / `1h` | Doubling, +≤20% jitter |
| `EVENTS_HANDLER_TIMEOUT` | `30s` | Lease is this + 30s |
| `EVENTS_METRICS_INTERVAL` | `15s` | Lag/depth sampling |
| `EVENTS_RETENTION` | `720h` | Settled facts only |
| `CRON_EVENTS_PRUNE_SCHEDULE` | `0 45 3 * * *` | |

---

## What this changed

- **Wallet checkouts now earn.** Only gateway Confirm ever wrote an earn intent,
  so wallet-paid orders earned no loyalty points, fired no referral credit and
  left no recommendation signal. Both rails now emit the same fact.
- **Receipts survive a crash.** They were sent from a post-commit goroutine; a
  restart in between lost the email with no trace.
- **Loyalty and recs retry.** They were best-effort post-commit calls that logged
  and moved on.
- **Checkout got shorter.** Those three side effects left the request path.

## Adding a fact

1. Add the type constant and payload struct in `internal/events/event.go`, and
   register the type in `topics`.
2. Give it an idempotency key keyed on the business entity, not the request.
3. Emit it via `Emitter.EmitTx` **on the caller's open transaction**. Assign to
   the function's named `err` — `RollbackOnErr` only unwinds when `*err` is
   non-nil, so `:=` there returns an error with the transaction still open.
4. Add a consumer in `internal/eventconsumers` and register it in
   `bootstrap/events.go`.

Routing is deliberately fail-**open**: an unregistered type falls back to the
default topic rather than erroring. Producers call it from inside an open money
transaction, and a routing error there would roll back a settled payment. A
misrouted event is recoverable; a rolled-back charge is not.
