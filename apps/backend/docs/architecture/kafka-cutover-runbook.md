# Kafka cutover operator runbook

**Audience:** whoever flips `EVENTS_BUS` in production.
**Depth:** this page. Design: [domain-events.md](./domain-events.md).
**Program:** K-10. Rollback is one env var at every step.

---

## 0. The one-line summary

`EVENTS_BUS=postgres` is the safe default and works with zero extra
infrastructure. The flip to `kafka` is optional, reversible, and gated on the
checks below. **Nothing on this page is urgent** — a deploy that never flips is
a supported end state.

---

## 1. Preconditions

All of these ship before the flip. They are not optional; each closes a failure
that is silent without it.

| | What | Why it gates the flip |
|---|---|---|
| K-1 | `RequiredAcks=RequireAll`, no client-side topic auto-creation | `acks=1` acknowledges before replication, so a failover after the ack drops a fact that is already marked `published` — never re-relayed, never consumed |
| K-2 | `dispatched_at` set on the Kafka ingest path | What lets the Postgres fallback tell "delivered" from "not delivered" |
| K-3 | `event_relay_lag_seconds` | `event_outbox_lag_seconds` is derived from consumption rows, so with the broker down it reads **0** — the one gauge that moves during a total ingest failure |
| K-4 | Staleness-gated Postgres fan-out | A broker outage delays `order.paid` side effects by `EVENTS_FALLBACK_AFTER` instead of stopping them. **This is the condition the single-broker/RF=1 decision rests on** |
| K-5 | Supervised ingest consumer | A fatal reader error used to kill ingest for the life of the process behind one log line |
| K-6 | Production broker surface | Named volume, resource limits, no published ports, SASL/SCRAM |
| K-7 | Topic retention ≥ `EVENTS_RETENTION` | Broker default is 7 days, the outbox keeps 30 — a group down longer than a week loses facts already marked published |
| K-9 | `cmd/event-worker` | Lets the API become emit-only |

---

## 2. Sequence

Each step is independently reversible. Do not compress them.

### Step 1 — broker up, API still on Postgres

```bash
docker compose --env-file .env.prod \
  -f apps/backend/deploy/kafka/docker-compose.kafka.prod.yml up -d
```

`init-topics` verifies every topic exists and **exits non-zero if any is
missing** — auto-creation is off client-side (K-1), so a missing topic is a
silent outage, not a self-healing hiccup. If that container failed, stop here.

Nothing has changed for the application yet: `EVENTS_BUS=postgres` ignores the
broker entirely.

### Step 2 — run the worker in Kafka mode while the API stays on Postgres

Run `cmd/event-worker` with `EVENTS_BUS=kafka` while the API keeps
`EVENTS_BUS=postgres`. Both paths are live; consumers are idempotent and share
one `domain_event_consumptions` ledger, so a fact reaching a consumer twice
settles once.

**Confirm both paths converge before going further:**

- `event_relay_lag_seconds` is low and flat — the relay is keeping up
- `kafka_consumer_lag` returns to ~0 after each batch
- `event_dlq_total` does not increase
- `event_ingest_up` is `1`

Sit in this state long enough to cover a real traffic peak. This is the step
that earns confidence; the flip itself is trivial by comparison.

### Step 3 — backfill, immediately before the flip

```bash
psql "$DATABASE_URL" -f apps/backend/deploy/kafka/cutover-backfill.sql
```

Without it the newly started relay publishes up to 30 days of already-consumed
facts in one burst. Nothing double-runs — consumers are idempotent — but live
`order.paid` side effects queue behind the replay at a broker that has never
carried load.

The script prints its counts before and after. `left_for_the_relay` should be
small; if it is not, consumers are behind and the flip should wait.

**Minutes matter here.** Facts fanned out between the backfill and the flip are
republished. That window is small and harmless — keep it small anyway.

### Step 4 — flip

```
EVENTS_BUS=kafka
EVENTS_WORKER=external
```

Restart the API replicas, then the worker.

### Step 5 — watch, for a full window

| Metric | Healthy | What a bad reading means |
|---|---|---|
| `event_relay_lag_seconds` | flat, near 0 | Climbing = the broker is unreachable or the relay is stuck |
| `kafka_consumer_lag` | returns to ~0 | Sustained growth = consumers cannot keep up |
| `event_ingest_up` | `1` | `0` = ingest stopped; check `event_ingest_restarts_total` for crash-looping |
| `event_dlq_total` | flat | **Any** increase needs a human |
| `event_outbox_lag_seconds` | flat | Climbing = handlers are slow or stuck |

If the Postgres fan-out fallback engages you will see a warning log —
`events fan-out fallback engaged: kafka did not deliver in time`. That means
K-4 is doing its job and the broker is not. Side effects are still happening,
delayed by `EVENTS_FALLBACK_AFTER`. Investigate the broker; you are not losing
facts.

---

## 3. Rollback

At **any** step:

```
EVENTS_BUS=postgres
```

Restart. That is the whole procedure. The outbox is the durability layer, so
nothing is lost by going back — facts already relayed stay published, facts that
were not are picked up by the Postgres path.

`EVENTS_ENABLED=false` is the bigger hammer: producers stop emitting and the
legacy in-request side effects take over. Use it if the bus itself is
misbehaving rather than just the broker.

---

## 4. Things that will bite

**Do not raise `EVENTS_FALLBACK_AFTER` above `EVENTS_BACKOFF_MAX`.** A fact that
failed to publish ~11 times backs off for the full hour; if the fallback window
is longer than that, the row sits unconsumed for the whole hour instead of being
picked up locally after minutes.

**`EVENTS_WORKER=off` is rejected at boot** while `EVENTS_ENABLED=true` —
nothing would consume the facts while producers keep emitting them.

**One broker, RF=1 is deliberate** (decision Q1) and is only safe because of
K-4. If K-4 is ever reverted, this topology stops being safe.
