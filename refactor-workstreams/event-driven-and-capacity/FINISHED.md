# Finished — event-driven + capacity

Append only after verify.

## K6-000 — Runnable k6 suite

**Status:** Complete  
**Date:** 2026-08-16

Shipped `checkout-journey.js`, `auth-browse.js`, `search.js`, `admin-read.js`,
hardened `cart-write.js`, founder runbook in `load-tests/k6/README.md`.
`k6` was not on the agent host; scripts passed `node --check`.

---

## ED-000…005, 007, 010b/c, 011a/b, 012a, 030, 031 — Domain event bus + checkout cutover

**Status:** Complete (uncommitted, in the working tree)  
**Date:** 2026-08-17  
**Docs:** `apps/backend/docs/architecture/domain-events.md` ·
`obsidian/11 Decisions/ADR Domain event outbox.md`

### Decisions taken (founder)

1. Postgres bus by default, Kafka opt-in — the broker is unreachable from the
   app containers today and prod has no worker service.
2. Wallet-paid orders now earn loyalty + referral. **This is a payout change**,
   taken deliberately: they never earned before.
3. Scope = foundation **plus** moving receipt/loyalty/recs off the request path.

### Shipped

| ID | What |
| --- | --- |
| ED-000 | `internal/events`: CloudEvents envelope + subject/causation/traceparent, own **fail-open** routing map |
| ED-001 | `domain_events` + `domain_event_consumptions`; `EnqueueTx` on the caller's `pgx.Tx` |
| ED-002 | Embedded poll worker; fan-out + consume loops; no broker required |
| ED-003 | Consumer registry, **lease-based** claim, exp backoff + jitter, dead-letter, replay |
| ED-003b | `events_prune` cron; only fully-settled facts are eligible |
| ED-004 | `event_*` metrics in `pkg/metrics` (private registry), lag gauge, ledger depth |
| ED-004b | Alert guidance + DLQ/replay runbook in `domain-events.md` |
| ED-005 | Notification outbox: `EnqueueTx`, real `SKIP LOCKED`, publish backoff, claim/confirm delivery ledger |
| ED-007 | Kafka relay + consumer-group adapter. **Built, never run against a live broker.** |
| ED-010b/c | Money services emit via `EnqueueTx`; cutover = the single `EVENTS_ENABLED` flag |
| ED-011a/b | `order.paid.v1` from gateway Confirm **and** wallet checkout, same type + key |
| ED-012a | Receipt consumer (synchronous `SendPaidOrderReceiptNow`) |
| ED-030 | Loyalty + referral consumer, with a refund re-check |
| ED-031 | Recommendation purchase consumer |

Also: `SMS_BASE_URL`/`SMS_TIMEOUT` de-hardcoded; frontend API-origin
consolidated into `lib/api/origin.ts` (three copies, only one honoured
`BACKEND_INTERNAL_URL`); Kafka compose given the `rumera.domain.v1` topics and
network instructions.

### Live bugs fixed on the way (all pre-existing)

- Wallet checkouts emitted nothing → no loyalty, no referral, no recs signal.
- Kafka consumer `continue`d without committing, but `FetchMessage` had already
  advanced — failed messages were **silently skipped forever**.
- Delivery ledger written *before* the send → first provider failure marked the
  message delivered permanently (at-least-once was at-most-never).
- `ClaimUnpublished` had no row lock despite three places documenting one.
- Failed publish stayed eligible every tick and starved the batch.
- Receipt sent from a post-commit goroutine; a crash lost it.
- Unsynchronised Kafka writer map (concurrent map write = process fatal).

### Bugs found by adversarial review and fixed

87 review agents, 6 lenses, 3 skeptics per finding: 18 confirmed, 9 refuted.

- **`ClaimDue` was not a lease** — `FOR UPDATE SKIP LOCKED` in an autocommit
  statement releases immediately, so 4 consume loops could run one handler
  concurrently with itself. Now leases `available_at`; also self-heals crashes.
- **Inline mode had no dedupe** (and inline is the default) — the receipt
  consumer would email again on every retry.
- **`Prune` deleted never-fanned-out facts** — vacuous `NOT EXISTS`.
- **Failed DLQ publish silently killed the reader goroutine.**
- **A sent OTP was dead-lettered with its plaintext code** when only the confirm
  write failed.
- Missing `event_id` index; settle transitions had no status guard;
  `Shutdown()` could hang; `EVENTS_WORKER=off` silently disabled all side
  effects (now rejected at boot).
- Self-caught: `SendPaidOrderReceipt` detaches via `async.GoCtx` and returns nil,
  so the consumer marked done before the mail was handed off.

### Verified

`go build` · `go vet` · full unit suite · 1071 frontend tests · `tsc` ·
migration applies to live Postgres · 11 integration tests against live Postgres
(rollback, duplicate key, SKIP LOCKED, lease exclusion, terminal settle, prune
guards) · server boots, registers 3 consumers, serves traffic, shuts down clean ·
live loop observed with real jittered backoff (2.3s → 4.2s → 8.7s).

**Pre-existing failures, not caused by this work** (bisected — they fail
identically with the emit disabled): `TestPaymentConfirm_DeductsStockAtomically`,
`TestPaymentConfirm_ReplayIsIdempotentAtDomain`, and four
`TestProductAggregate*` integration tests.

### Still open

- Kafka mode never exercised against a live broker.
- No standalone events-worker binary — `EVENTS_WORKER` must be `embedded`.
- ED-011c (gift-card email dual-write inside the Confirm TX) not done.
- `cmd/notification-worker` threads the signal context into the provider call,
  so SIGTERM aborts an in-flight SMS.
- Recs purchase dedupe is a non-atomic `NOT EXISTS` with no unique constraint
  (pre-existing schema gap).
- The Kafka ingest goroutine is not awaited on shutdown.
