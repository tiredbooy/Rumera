---
tags: [decision, reliability, money, events]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Domain event outbox (Postgres-first, Kafka optional)

**Status:** accepted · **Date:** 2026-08-17
**Program:** ED-000…ED-005, ED-010b, ED-011a/b, ED-012a, ED-030, ED-031
**Supersedes:** roadmap **B5** ("outbox saga", previously `DEFERRED`)
**Related:** [[ADR Outbox Kafka notifications]] · [[ADR Idempotency platform]] ·
[[ADR Order reserve and pay deduct atomic]]

## Context

Paid-order side effects — the receipt email, the loyalty award, the referral
completion, the recommendation purchase signal — ran as fire-and-forget work
after `COMMIT`. Three consequences, all observed in the code:

1. **Crash loses them.** The receipt was sent from `async.GoCtx` after commit; a
   restart in that window lost the email with no trace and no retry.
2. **The wallet rail had none of them.** Only gateway `Confirm` wrote an earn
   intent, so wallet-paid orders earned **no** loyalty points, fired **no**
   referral credit and left **no** recommendation signal — ever.
3. **They sat on the request path.** Checkout latency included work the customer
   does not wait for.

A direct publish to Kafka does not fix this. Publishing before commit announces
a payment that may roll back; publishing after commit loses the message on any
crash in between. For money, neither is acceptable.

## Decision

**Write the fact to a Postgres table inside the same transaction as the money.**
`domain_events` + `EnqueueTx(ctx, tx, env)`. The fact commits with the payment or
it does not exist. A worker then moves it onward.

1. **Two outboxes, not one.** `domain_events` carries **facts** ("order 42 was
   paid") with N independent consumers. `notification_outbox` stays the
   **command** stream ("send this SMS") with exactly one deliverer. A fact
   consumer may issue a command; never the reverse.
2. **Per-consumer ledger.** `domain_event_consumptions`, one row per
   `(event, consumer)`, each with its own status, attempt count, backoff and
   dead-letter state. A broken receipt mailer cannot stop loyalty from awarding.
3. **Transport is config, not architecture.** `EVENTS_BUS=postgres` (default)
   consumes straight from the outbox; `=kafka` relays to `rumera.domain.v1`
   first. **Consumers are byte-identical in both modes.**
4. **Postgres is the default** because it is the only mode that works today:
   the Redpanda compose is a separate opt-in stack on its own docker network,
   `.env.prod.example` carries no Kafka vars, and neither compose passes
   `KAFKA_BROKERS` to the backend.
5. **Kafka does not run handlers inline.** Its consumer only writes ledger rows
   and commits the offset; the consume loop runs the handlers. This stops one
   slow consumer blocking the partition, and stops a Kafka retry re-running
   consumers that already succeeded.
6. **The claim is a lease, not a lock.** `FOR UPDATE SKIP LOCKED` inside an
   autocommit statement releases the instant it returns, so the claim also
   pushes `available_at` forward by the handler timeout plus slack. Without
   that, four concurrent consume loops re-claim the same row and run one handler
   concurrently with itself.
7. **Routing fails open.** An unregistered event type falls back to the default
   topic instead of erroring — the routing lookup happens inside an open money
   transaction, and an error there would roll back a settled payment. A
   misrouted event is recoverable; a rolled-back charge is not.
8. **Events notify; they are never the ledger.** Reserve, deduct, wallet debit,
   refund and coupon burn stay explicit SQL in their own transaction.

## Consequences

**Good**

- A paid-order side effect cannot be lost by a crash.
- Wallet checkouts now earn — a real payout change, taken deliberately.
- Failures retry with backoff and end in an inspectable dead-letter state
  instead of a log line nobody reads.
- Checkout no longer pays for the receipt, the award or the recs write.
- Fixed while in there: the notification relay had no row lock despite three
  places claiming it did; the delivery ledger was written before the send, so
  the first provider failure marked a message delivered forever; a failed Kafka
  handler was silently skipped because `FetchMessage` had already advanced.

**Bad / accepted**

- Side effects are now eventually consistent — roughly 1–2s under the default
  intervals, longer while a consumer is in backoff. FE copy already hedges this
  ("به‌زودی"), which is why no UI change was needed.
- Two more tables to operate, prune and alert on.
- At-least-once means every consumer must carry its own domain-level idempotency
  guard. The ledger narrows the window; it does not close it.
- `EVENTS_ENABLED=false` must stay a working rollback, so both the event path
  and the legacy in-request path exist side by side until the bus has proven
  itself. Exactly one is live at a time, gated on that single flag.

## Alternatives rejected

| Option | Why not |
|---|---|
| Publish to Kafka directly from the service | Dual write: either announce a payment that rolls back, or lose the message on a crash after commit |
| Widen `notification_outbox` into the fact bus | Commands have one deliverer and an email DLQ; facts have N consumers with independent retry. Merging gives every consumer the wrong failure semantics |
| Event-source the order/wallet ledgers | Enormous change, no problem here it solves. The money tables already are the ledger |
| Keep the post-commit hooks and just add a cron sweeper | Fixes only the leftovers that happen to have an intent row. Wallet checkout has none, and the receipt and recs paths have no durable record at all |
| Kafka as the default transport | The broker is unreachable from the app containers today, and prod has no worker service. Would have made the default path the one that cannot run |

## Verification

Migration `20260817120000_domain_events.sql`. Integration tests
(`tests/integration/domain_events_test.go`) prove against live Postgres that a
fact rolls back with its transaction, that a duplicate key collapses, that
`SKIP LOCKED` excludes a concurrent relay, that the lease excludes a concurrent
claim, that settled rows are terminal, and that prune keeps anything
undelivered. Verified live: fan-out to three consumers with real jittered
backoff on the failing one.

## Open

- Kafka mode is implemented and unit-tested but has never been run against a
  live broker.
- No standalone events-worker binary; `EVENTS_WORKER` must be `embedded`.
- Gift-card fulfilment still dual-writes its email on a second connection inside
  the Confirm transaction (ED-011c).
