# Agent board — event-driven + k6

Append-only. Propose lettered tasks only. No application code except the k6 agent.

**`TASKS.md` is the authoritative board.** This file records what each lane
concluded. Where an ID here differs from `TASKS.md`, `TASKS.md` wins.

Lanes:

- `ed-money` — orders, payments, inventory, wallet, coupons
- `ed-platform` — outbox, envelope, relay vs Kafka, cron extraction
- `ed-catalog` — product/index/cache invalidation
- `ed-engagement` — loyalty, recs, analytics, reviews, alerts
- `ed-frontend` — what FE must **not** change; any contract for eventual consistency
- `k6-suite` — **implement** complete runnable scripts + README how-to

IDs: ED-000+ / K6-000+. Do not reopen closed PH/PR unless a live bug.

## Merged / superseded IDs (2026-08-17 reorganisation)

| Dropped | Reason |
| --- | --- |
| **ED-013a** | Duplicate of **ED-030** (loyalty + referral on `order.paid`) |
| **ED-013b** (money: sweeper) | Merged into **ED-006** (cron registration) |
| **ED-013b** (board: recs) | Duplicate of **ED-031** |
| **ED-032** | Merged into **ED-006** — the sweeper was three IDs |
| **ED-027**, **ED-036** | Merged into **ED-040** — one FE doc lock, not three |
| **ED-034** | Not a task. "Keep the analytics queue" is a non-goal |

Added: **ED-003b** (retention), **ED-004b** (lag/DLQ alerts), **ED-010c**
(cutover strategy), **ED-044** (loopback revalidate), **K6-004** (outbox lag).

`order.refunded.v1` is emitted by **ED-016a**, not ED-017a. ED-017a is
`payment.failed.v1` only.

## ed-platform

Findings: `findings-ed-platform.md`. No app code. New `domain_events` fact outbox;
**keep** `notification_outbox` as the SMS/email command stream. Default bus is
**Postgres poll** (`EVENTS_BUS=postgres`). Kafka is ED-007 only. Money stays in
explicit TXs.

**Reuse / do not reinvent:** CloudEvents-ish `notifications.Envelope`,
`Relay`+`Publisher`, worker modes, `notification_deliveries` shape, PH-011 HTTP
keys (not the event ledger), OTel provider.

**Live bugs on the notify path (fix in ED-005):** claim has no `SKIP LOCKED`
(the comment claims it does); enqueue is pool-not-TX; `TryBegin` inserts delivery
**before** send so a failed SMS/email never retries; `NOTIFICATIONS_MODE=async`
requires Kafka.

**Cron:** rollups, birthday, reservation TTL, idempotency prune, alert/box
due-scan **stay cron**. Meili full reindex + recs profile rebuild stay cron;
incremental consumers are ED-020 / ED-030. Register `ProcessPendingLoyaltyAwards`
as cron (**ED-006**).

- **ED-000** Envelope + `internal/events`
- **ED-001** `domain_events` (+ consumptions/DLQ) migration; `EnqueueTx`; unique `idempotency_key`
- **ED-002** Local poll worker; no brokers; embeddable in `cmd/server`
- **ED-003** Consumer registry, SKIP LOCKED claim, retry/backoff, Postgres DLQ + replay
- **ED-003b** Retention/prune for events, consumptions, DLQ *(new — nothing prunes the bus)*
- **ED-004** OTel spans + `event_*` and the documented-but-missing `notification_*` metrics
- **ED-004b** Lag/DLQ alerts + runbook *(new — metrics with no alarm are decoration)*
- **ED-005** Notification hardening: `EnqueueTx`, SKIP LOCKED, ledger pending-vs-done, `NOTIFICATIONS_BUS=postgres`
- **ED-006** Cron taxonomy (must include `subscription_renewal_email`) + register the loyalty sweeper
- **ED-007** Kafka adapter (optional). Blocked on 002+003
- **ED-008** Golden-path tests (`test.ping.v1`) + DLQ replay + redacted inspect
- **ED-009** ADR + dual-doc; mark roadmap B5 superseded

Claim order: 000 → 001 → 002 → 003; 005 parallel; 003b/004/006/008 after the loop
exists; 004b after 004; 007 after 003; 009 last.

To other lanes: emit facts via `EnqueueTx` only after ED-001; do not publish
Kafka yourselves.

## ed-money

Findings: `findings-ed-money.md`. No app code. Money **commands** stay SQL:
reserve, Confirm+MarkAsPaid+deduct, wallet `PurchaseTx`, refund credit + restock,
cancel/TTL release, coupon `FOR UPDATE`. Events are facts emitted from inside
those transactions; consumers never move money or stock.

**Live gaps found:**

- Notification outbox `Enqueue` is pool-only — "same TX as the domain write" is
  documented but not implemented anywhere (verified: zero `EnqueueTx` in the repo).
- Receipt is post-commit `async.GoCtx`; a crash loses the email.
- Wallet-paid create never inserts an earn intent and never records a recs
  purchase — Confirm is the only producer.
- Gift email dispatches on a **second connection** inside the Confirm TX.
- `POST /orders` is counted as a purchase by `stats_job`, including pending orders.
- TTL expire flips status, then separately releases stock and fails payments —
  three connections, no single TX.

Event catalog: `order.placed.v1` *(Q3)*, `order.paid.v1`, `order.payment_failed.v1`,
`order.cancelled.v1`, `order.refunded.v1`, `reservation.expired.v1`,
`gift.purchased.v1`. Idempotency `order:{id}:{verb}`.

- **ED-010a** Event catalog + anti-goals (docs)
- **ED-010c** Cutover / dual-run strategy *(new — ED-011a assumed a flag nobody defined)*
- **ED-010b** Money services call `EnqueueTx`
- **ED-011a/b/c** Emit `order.paid.v1` from Confirm **and** wallet; gift email via TX outbox
- **ED-012a** Receipt consumer
- **ED-014a** Paid analytics from `order.paid`
- **ED-015a** TTL expire+release+fail in one TX *(command rewrite — highest risk)*, then emit
- **ED-016a** `order.cancelled.v1` + `order.refunded.v1`
- **ED-017a** `payment.failed.v1`

To `ed-engagement`: `order.paid.v1` carries `order_id`, `user_id`, settled `amount`
from **both** rails. `order.refunded.v1` after the refund TX commits.

## ed-catalog

Findings: `findings-ed-catalog.md`. Reads stay HTTP. Do not event-source the
catalogue. No Meili storefront cutover. Depends ED-000.

- **ED-020** Catalog event contract (IDs + op + revision; consumer re-reads Postgres).
- **ED-021** Emit from product aggregate + granular product/variant/tag writes (same TX).
- **ED-022** Incremental Meili upsert/delete; keep nightly `FullReindex`.
- **ED-023** Redis cache-bust consumer (`product:v1:`, `category:v1:tree`, `recipe:v1:` + old slug).
- **ED-024** Brand/category/tag/option fan-out (today no product cache or Meili title refresh).
- **ED-025** Media + recipe/blog/hero events (recipe slug rename; blog/hero have no API Redis).
- **ED-026** Inventory/price → product cache only (cross ed-money). No stock in Meili.

FE contract note (was ED-027) is folded into **ED-040**.

## ed-engagement

Findings: `findings-ed-engagement.md`. No app code. Consumers only — `ed-money`
emits `order.paid` / `order.refunded`; `ed-platform` owns the generic outbox.
Do not fold HTTP analytics into that outbox.

**Keep vs move**

- **Consume events:** loyalty+referral earn, recs purchase (same `order.paid`);
  clawback on `order.refunded` (do not block the refund TX).
- **Stay request-path:** redeem, referral claim, review/alert CRUD, recs GET +
  `POST /interactions`, cart `add_to_cart`, signup/review earn (v1, already idempotent).
- **Stay cron:** birthday, recs profile refresh, analytics rollups, alert_check (15m).
- **Keep `analytics.Queue`:** drop-on-full, Timescale, every HTTP hit. Outbox is
  durable main-DB — wrong contract and wrong DB. *(Non-goal, not ED-034.)*

**Live miss:** wallet-paid `POST /orders` never inserts `payment_loyalty_awards`
and never records a recs purchase. One `order.paid` from both rails fixes it.

- **ED-030** Loyalty + referral consume `order.paid` (sole owner; covers wallet)
- **ED-031** Recs `RecordPurchasesForOrder` consume `order.paid` (sole owner)
- **ED-033** Clawback consume `order.refunded`; keep the request-path hook until it exists
- **ED-035** Alerts stay cron; optional variant restock/price consumer later

Sweeper registration is **ED-006** (was also ED-032). Non-consumer guardrails are
**ED-040** (was ED-036).

## ed-frontend

Findings: `findings-ed-frontend.md`. No app code. The storefront already matches
the charter: **zero** EventSource / WebSocket / Kafka under `apps/frontend`;
search is `GET /products?search=`; admin writes revalidate Next tags in-process.

**Real gaps, not hypotheticals:**

- Copy implies OTP/reset/receipt mail is already *sent* when the API returns 202
  or 200 — under `NOTIFICATIONS_MODE=async` it is only *queued*.
- Go emits strong ETags on product/category-tree/recipe; Next never sends
  `If-None-Match`, and `publicRequest` would **throw** on a 304 because it always
  calls `response.json()`.
- `revalidateAfterAdminMutation` runs only in the Next process that handled the
  write — a Go cache-bust consumer cannot expire Next tags without a loopback route.

- **ED-040** FE transport lock (docs) — sole owner of "browser is not an event client"
- **ED-041** Honest async copy (202 = queued)
- **ED-042** Conditional GET on the Next→Go hop; 304-safety can ship first
- **ED-043** Admin orders stay pull-HTTP; SSE deferred until ops writes an SLA
- **ED-044** Loopback revalidate endpoint *(new — blocked on ED-023)*

## k6-suite

Findings: `findings-k6.md`. The only lane that ships application-adjacent code.

**K6-000 done** (see `FINISHED.md`): `checkout-journey.js`, `auth-browse.js`,
`search.js`, `admin-read.js`, hardened `cart-write.js`, `lib/config.js`
`loadProfile(default)`, founder runbook. Verified present in `load-tests/k6/`.
Not executed — `k6` was not installed on the agent host; scripts passed
`node --check` only.

- **K6-001** Run the suite on a seeded box from a separate load generator (founder)
- **K6-002** `TOKEN_FILE`, one JWT per VU — shared token measures lock contention
- **K6-003** Checkout write profile, default off; needs K6-002 + cleanup playbook
- **K6-004** Outbox lag scenario *(new — blocked on ED-002; also: checkout must
  succeed with the event worker stopped)*
