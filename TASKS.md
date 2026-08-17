# Rumera — task board

**Updated:** 2026-08-17 · **Evidence:** backend recon (7 areas), adversarial code
review (87 agents), frontend/infra audit (71 findings), admin UX audit (54 findings).
Every task has file:line evidence. Nothing here is generic best-practice advice.

**Completed work has been removed from this board.** What already shipped is recorded
in `refactor-workstreams/event-driven-and-capacity/FINISHED.md` — do not redo it.


> ## ▸ ROUTING — read this first
>
> Every task line begins with an owner tag: **`@grok`** or **`@claude`**.
>
> **If you are Grok:** work ONLY on lines tagged `@grok`. Skip every `@claude` line —
> do not read ahead into them, do not "helpfully" fix them. If a `@grok` task turns out
> to depend on a `@claude` task, stop and say so rather than doing the `@claude` one.
>
> **If you are Claude:** work ONLY on lines tagged `@claude`, same rule in reverse.
>
> List your own tasks:
> ```bash
> grep '^- \[ \] `@grok`'   TASKS.md    # or @claude
> ```
> Pre-filtered copies also exist — **`TASKS-GROK.md`** and **`TASKS-CLAUDE.md`**. They
> are generated from this file; this file is the source of truth.

---

## Decisions (previously open)

### Q1 — Single Redpanda broker, RF=1. **Not a cluster.**

Because the Postgres outbox *is* the durability layer. With **K-4** (staleness-gated
fallback) a fact that Kafka loses is still in `domain_events` and gets picked up by the
Postgres path. That is the whole point of the architecture you asked for: Kafka
primary, Postgres underneath.

A three-broker cluster costs 3× resources and real operational weight (ISR management,
rebalancing) to protect against a failure the fallback already covers.

**Conditions — this decision is only safe if all three hold:**
1. **K-4 ships before the cutover.** Without the fallback, one broker = one point of
   total failure. It is not optional.
2. `acks=all` + a **named volume** anyway (K-1, K-6). With RF=1, `acks=all` still means
   "the leader fsynced", which is what protects against a restart.
3. **Revisit at three brokers when** event volume makes the fallback scan expensive, or
   a second service needs to consume independently of the shop.

### Q2 — `cmd/event-worker` owns consumption. The API becomes emit-only.

Embedded consumption is what ships today and it is wrong for Kafka-primary:
- Every API rolling deploy triggers a **consumer-group rebalance**
- Scaling the API for HTTP traffic scales group membership (with 3 partitions, a 4th
  replica gets nothing)
- `EVENTS_CONCURRENCY=4` handler slots compete with checkout for the same Postgres pool
- A wedged consumer cannot be restarted without restarting the API

Same image, different entrypoint — deployment cost is low, and `cmd/notification-worker`
is the precedent. **`EVENTS_WORKER=embedded` stays supported for local dev** (one
process, no broker); production runs `external`.

This also serves the modularity you want: a separate worker means the loyalty consumer
is independently deployable and independently killable.

### Loyalty must be completely modular in admin

Recorded as **L-1…L-10** in Track C. The audit found containment is *already good* —
only one loyalty reference exists outside `features/admin/loyalty/`. The real gaps are
capability, not coupling: **there is no programme editor at all**, the kill-switch the
backend already supports is dropped at the type boundary, and there is no loyalty
permission, so anyone who can edit a customer's phone number can mint unlimited points.

---

## How to read

| | |
| --- | --- |
| **Effort** | S = under half a day · M = 1–3 days · L = multi-day |
| **Severity** | 🔴 blocks money/users · 🟠 quality bar · 🟡 real but deferrable |
| **Owner** | the `@grok` / `@claude` tag that **starts** every task line |

### How work is split

The **grok** lane — well-scoped, verifiable, mostly single-purpose. The correct answer is
unambiguous and a mistake shows up immediately. Every grok task below carries a
**Files / Do / Done when** brief so it can be picked up without this conversation's
context.

The **claude** lane — money paths, transaction semantics, cross-system reasoning,
architectural restructures, and migrations where a subtle mistake is expensive and hard
to detect. Grok can do these; the reason to route them here is *cost of being subtly
wrong*, not capability.

**Tracks A, B and C touch different files and run in parallel.** Phase 0 and 1 come
first regardless.

---

# Phase 0 — Stop the bleeding

- [x] `@claude` **P0-1 · 🔴 · S — Saved addresses return zero shipping methods**
  Account → Addresses stores `"ایران"`; checkout matches an ISO region code. A
  returning customer reaches checkout step 2 and gets «روش ارسالی برای منطقهٔ شما یافت
  نشد» with no way forward. Needs the write path, the read path and any existing rows
  reconciled — hence claude.

- [x] `@grok` **P0-2 · 🔴 · S — Dark form fields are invisible (1.16:1)**
  **Files:** `app/globals.css:148-149,169`, `components/ui/input.tsx:11`, `components/ui/select.tsx:47`
  **Do:** `--border: oklch(1 0 0 / 9%)` → `oklch(0.32 0.014 56)`; `--input: … / 13%` →
  `oklch(0.40 0.016 58)`; mirror `--sidebar-border`. Then replace `border-transparent`
  with `border-input` in input.tsx and select.tsx.
  **Done when:** every control has a visible edge at rest in dark mode, ≥3:1 (WCAG 1.4.11).
  *Dark is the default theme — this affects every form in checkout, login and admin.*

- [x] `@grok` **P0-3 · 🟠 · S — Light-mode gold fails AA as text (3.05:1, 274 uses)**
  **Files:** `app/globals.css:84,95,97,112`
  **Do:** `--primary: oklch(0.66 0.13 72)` → `oklch(0.50 0.14 68)`; set
  `--primary-foreground: oklch(0.98 0.01 85)`. Mirror into `--gold` and
  `--sidebar-primary` (both alias it). If the lighter gold must survive as a *fill*,
  instead add `--gold-ink: oklch(0.50 0.14 68)` and repoint only the text uses.
  **Done when:** `.eyebrow`, `.prose-rumera a`, `variant="link"` and the product-card
  brand line all clear 4.5:1 on `--background` and `--card`.

- [x] `@grok` **P0-4 · 🟠 · S — Dark wine is 3.37:1 on stock/refund copy**
  **Files:** `app/globals.css:154` · **Do:** `oklch(0.55 0.16 20)` → `oklch(0.62 0.16 20)`.
  Leave light alone (already 8.73:1). **Done when:** ≥4.5:1 on `--card`.

- [x] `@grok` **P0-5 · 🟠 · S — Persian descenders collide at `leading-[1.05]`**
  **Files:** `category-index-view.tsx:63`, `tag-index-view.tsx:71`,
  `journal-list-view.tsx:108`, `recipe-detail-view.tsx:148`, `recipe-list-view.tsx:116`,
  `category-hero.tsx:66`, `hero-carousel.tsx:321`, `components/ui/dialog.tsx:133`,
  `app/globals.css:189`
  **Do:** every `leading-[1.05]/[1.06]/[1.08]` → `leading-[1.3]`; dialog title
  `leading-none` → `leading-snug`; add `line-height: 1.75` to the `body` rule in
  `@layer base`. **Done when:** ج چ ح خ ع غ no longer overlap the line below at any breakpoint.

- [x] `@grok` **P0-6 · 🟠 · S — Focus is invisible (1.36:1), and the FAQ accordion has none at all**
  **Files:** `app/globals.css:95`, `components/ui/accordion.tsx`
  **Do:** raise the ring opacity so the indicator clears 3:1 in **both** themes;
  `AccordionTrigger` sets `outline-none` and replaces it with nothing — add
  `focus-visible:ring-2 focus-visible:ring-ring`. **Depends on P0-3** (`--ring` aliases
  `--primary`). **Done when:** tabbing the public FAQ shows focus on every trigger.

- [x] `@claude` **P0-7 · 🔴 · S — Two `no-store` fetches make every public page dynamic**
  They defeat every `revalidate` below them, so home, PDP, PLP, categories, journal,
  recipes, about and FAQ all render from scratch on every request. Highest-leverage perf
  fix in the codebase. Claude because it needs verifying nothing depends on the
  freshness those two calls were buying. *File:* `app/(storefront)/layout.tsx`

- [x] `@grok` **P0-8 · 🟠 · S — Hero ships `loading="lazy"` + `fetchpriority="high"` together**
  **Files:** `features/home/components/hero-carousel.tsx`, `components/optimized-image.tsx`
  **Do:** the first slide's image gets `loading="eager"` + `priority`; make
  `OptimizedImage` emit `fetchpriority="high"` whenever `priority` is set (four call
  sites request priority and get no hint, including the PDP gallery LCP image).
  **Done when:** the home hero and the PDP main image are in the preload scanner.

- [x] `@grok` **P0-9 · 🟠 · S — `f=webp` is forced, overriding AVIF negotiation**
  **Files:** `lib/media/resolve-media-url.ts` · **Do:** stop appending `f=webp`; let the
  backend content-negotiate (it already supports AVIF). **Done when:** an AVIF-capable
  browser receives AVIF for product images. *20–30% smaller on an image-dense catalogue.*

---

# Phase 1 — Safety net

- [x] `@grok` **P1-1 · 🔴 · S — Add CI (there is none, anywhere)**
  **Files:** new `.github/workflows/ci.yml`
  **Do:** on push + PR — job 1: `cd apps/backend && go build ./... && go vet ./... && go test ./...`;
  job 2: `cd apps/frontend && npx tsc --noEmit && npx vitest run`; job 3: integration with
  a `postgres:17-alpine` service, `TEST_DATABASE_URL` set, running
  `go test -tags=integration -count=1 ./tests/integration/...`.
  **Done when:** all three run on every PR. Mark job 3 `continue-on-error` until P1-2 lands.

- [x] `@claude` **P1-2 · 🔴 · M — Green the integration baseline**
  `TestPaymentConfirm_DeductsStockAtomically`, `TestPaymentConfirm_ReplayIsIdempotentAtDomain`
  and four `TestProductAggregate*` fail today. Bisected — they predate the event work. A
  red baseline is how regressions hide.

- [ ] `@claude` **P1-3 · 🟠 · M — Commit the working tree in reviewable chunks**
  815 changed/untracked files. Not reviewable by anyone.

- [x] `@grok` **P1-4 · 🟠 · S — Add event-bus alert rules**
  **Files:** `deploy/observability/prometheus-rules.yml`
  **Do:** six alerts exist and none are about events. Add, on `{job="rumera-backend"}`:
  `event_outbox_lag_seconds > 300` for 5m; `increase(event_dlq_total[15m]) > 0`;
  `rate(event_published_total{result="error"}[5m]) > 0` for 5m.
  **Note in the PR:** Prometheus is only in `docker-compose.dev.yml` — it is **not in the
  prod stack**, so these rules have nowhere to run yet. Flag that; do not try to fix it here.

- [ ] `@claude` **P1-5 · 🟠 · S — Analytics queue loses its buffer on every deploy**
  Started with the *signal* context, so on SIGTERM every worker exits with its in-hand
  batch and `Shutdown()` discards up to 10,000 buffered events. Concurrency semantics →
  claude. *Files:* `internal/bootstrap/app.go:146,162`, `internal/analytics/queue.go:118-120`

---

# Track A — Backend: make Kafka primary

## A1 — Correctness first (before any broker carries traffic)

- [x] `@claude` **K-1 · 🔴 · S — `RequiredAcks = RequireAll`, stop relying on topic auto-creation**
  `acks=1` acknowledges before replication. A leader failover after the ack drops the
  message; the fact is marked `published`, never re-relayed, never consumed. **A customer
  pays and the receipt, the loyalty award and the recs signal never happen**, silently.

- [x] `@grok` **K-2 · 🟠 · S — Set `dispatched_at` on the Kafka ingest path**
  **Files:** `internal/events/postgres/store.go:222-246` (`FanOutEnvelope`)
  **Do:** after inserting the consumption rows, add
  `UPDATE domain_events SET dispatched_at = NOW() WHERE id = $1 AND dispatched_at IS NULL`,
  guarded on `pk != 0` (the function tolerates a foreign fact and records PK 0).
  **Why:** `FanOut` sets it, `FanOutEnvelope` does not, so in Kafka mode it stays NULL
  forever — the partial index `WHERE dispatched_at IS NULL` degenerates to a full index,
  and both K-4 and any rollback rescan the whole backlog.
  **Done when:** a Kafka-ingested fact has a non-null `dispatched_at`.

- [x] `@claude` **K-3 · 🟠 · M — The lag gauge reads 0 during total ingest failure**
  `event_outbox_lag_seconds` is derived from consumption rows. In Kafka mode with the
  broker down, **no consumption rows exist** — so the gauge reads 0 during exactly the
  failure it exists to catch. Add a relay-side `event_relay_lag_seconds` (age of the
  oldest unpublished fact).

- [x] `@claude` **K-4 · 🔴 · M — Make the Postgres fan-out a staleness-gated fallback**
  Today `fanOutLoop` is skipped entirely in Kafka mode, so a five-minute broker outage
  stops every `order.paid` side effect and a row that failed ~11 times stays parked for
  an hour after recovery. Re-enable it in Kafka mode gated on "older than N and still has
  no consumption rows". **Depends on K-2.**
  **This is the task that makes Q1's single broker safe. It is not optional.**

- [x] `@claude` **K-5 · 🟠 · S — The embedded Kafka consumer dies silently**
  Any fatal reader error permanently disables ingest for the life of the process — one
  ERROR log, no metric, no health signal, no restart, healthcheck stays green.

## A2 — Production surface (none of this exists)

- [x] `@claude` **K-6 · 🔴 · M — Build a production deployment surface**
  Verified: Redpanda has **no volume** (broker data wiped on restart), single broker,
  `--check=false`, published host ports, a console service, no SASL, on its own docker
  network. `docker-compose.prod.yml` has **no Kafka service, no worker service**, and
  passes **zero** `EVENTS_*`/`KAFKA_*` env — so even `EVENTS_ENABLED=false`, the
  documented emergency lever, cannot be pulled in production today.
  Needs: `docker-compose.kafka.prod.yml` on `rumera_network`, named volume, resource
  limits, no published ports, SASL/SCRAM through a `Dialer` in both `NewPublisher` and
  `NewConsumer` (neither sets one), plus the env passthrough.

- [x] `@grok` **K-7 · 🟠 · S — Topic retention below outbox retention; Kafka DLQ uncounted**
  **Files:** topic creation script (new), `internal/notifications/kafka/consumer.go:139-160`
  **Do:** (a) create prod topics from a versioned script with
  `retention.ms` ≥ `EVENTS_RETENTION` (720h) — the broker default is 7 days while the
  outbox keeps 30, so a group down longer than a week loses messages that are already
  marked published; (b) call `metrics.IncEventDLQ(...)` in the Kafka DLQ branch — it is
  only incremented from the Postgres path today, so `event_dlq_total` stays flat while
  facts are buried. **Depends on K-6.**

- [x] `@grok` **K-8 · 🟠 · S — Export Kafka consumer-group lag**
  **Files:** `internal/notifications/kafka/consumer.go`, `pkg/metrics/events.go`
  **Do:** register a `kafka_consumer_lag{topic,group}` gauge in `pkg/metrics` (the
  registry is private — it must be declared there, not via `MustRegister` elsewhere).
  Add a ticker goroutine on `Consumer` iterating `c.Readers`, calling `r.Stats()` and
  setting the gauge from `ReaderStats.Lag`. ~20 lines, no new dependency.
  **Done when:** `/metrics` reports lag per topic. *With Kafka primary this is THE health number.*

- [x] `@claude` **K-9 · 🟠 · M — Add `cmd/event-worker`; relax the config guard** *(Q2)*
  Config currently hard-rejects any non-embedded worker (I added that guard because no
  binary existed). Model on `cmd/notification-worker`; add to the Dockerfile and a prod
  service; narrow the guard to reject only `off`. API replicas then run
  `EVENTS_WORKER=external` and only emit. Keep `embedded` valid for local dev.

## A3 — Cutover

- [x] `@claude` **K-10 · 🟠 · S — Backfill `published_at`, then flip**
  Nothing sets `published_at` in postgres mode, so the instant you flip, the relay
  publishes **up to 30 days of already-consumed facts**. Idempotent, so nothing
  double-runs — but a thundering herd at a broker that has never carried load, with live
  `order.paid` side effects stalled behind it.
  Immediately before the flip:
  ```sql
  UPDATE domain_events SET published_at = NOW()
  WHERE published_at IS NULL AND dispatched_at IS NOT NULL;
  ```
  **Sequence:** K-1…K-5 with `EVENTS_BUS=postgres` → broker up (K-6) with explicit topics
  (K-7) → run `event-worker` in kafka mode while the API stays postgres, confirm both
  paths converge → backfill → flip API to `EVENTS_BUS=kafka` + `EVENTS_WORKER=external` →
  watch `event_relay_lag_seconds` and `kafka_consumer_lag` for a full window.
  **Rollback at any step: `EVENTS_BUS=postgres`.**

## A4 — Remaining backend debt

- [x] `@grok` **A-1 · 🟠 · S — SIGTERM aborts an in-flight SMS**
  **Files:** `cmd/notification-worker/main.go:104,122`
  **Do:** the signal context is threaded into `consumer.Run` and reaches the provider
  HTTP call, so a deploy cancels a send mid-flight. Mirror `internal/bootstrap/events.go`:
  run on `context.Background()`, stop by calling `consumer.Close()` when the signal
  context fires. **Done when:** SIGTERM lets an in-flight send finish, confirm and commit.

- [x] `@grok` **A-2 · 🟠 · S — Recs purchase dedupe has no unique constraint**
  **Files:** new migration, `internal/features/recommendations/repository.go:148`
  **Do:** the dedupe is a non-atomic `NOT EXISTS` under READ COMMITTED — two concurrent
  runs both insert, and at-least-once delivery makes that reachable. Add
  `CREATE UNIQUE INDEX ... ON user_product_interactions (user_id, product_id, (metadata->>'order_id')) WHERE interaction_type = 'purchase' AND metadata ? 'order_id'`
  and switch the insert to `ON CONFLICT DO NOTHING`, keeping `RowsAffected` as the
  inserted signal. **Done when:** two concurrent identical calls produce one row.

- [ ] `@claude` **A-3 · 🟡 · S — Gift-card email dual-writes inside the Confirm TX** (ED-011c)
  `notifyPurchased` writes on a second connection while `tx` is open; a rollback can
  still email a card that never committed. `EnqueueTx` exists now — the care needed is
  that the retry loop shares one `pgx.Tx` with no savepoints (state 25P02).
- [x] `@grok` **A-4 · 🟡 · S — Await the Kafka ingest goroutine on shutdown**
  **Files:** `internal/bootstrap/events.go:105-131` · **Do:** `start()` launches
  `consumer.Run(context.Background())` in a bare goroutine with no handle, so `stop()`
  returns without waiting. Store a cancel func + `sync.WaitGroup`; in `stop()` cancel,
  `Close()`, then wait. **Done when:** shutdown blocks until the ingest goroutine returns.
- [x] `@claude` **A-5 · 🟠 · M — Kill the wallet/gateway asymmetry permanently**
  Wallet checkout writes no `payment_transactions` row at all. Either give it one, or
  write down the rule: **`order.paid.v1` is the only paid signal — never hook `Confirm`
  directly again.** Otherwise every future post-payment feature silently misses wallet
  buyers, exactly as loyalty and recs did.
- [x] `@claude` **A-10 · 🟠 · S — No admin read route for the wallet ledger**
  Fallout from A-5, which decided *not* to fabricate a `payment_transactions` row for
  wallet. The debit already exists — `wallet/repository.go:126` writes it with
  `reference_order_id` — but `wallet/routes.go` `RegisterAdmin` mounts only the credit
  POST, so an operator investigating a wallet purchase has no trail but raw SQL:
  `/admin/payments?order_id=X` is empty and `/admin/orders/:id` carries no `payment`
  block. One admin GET over `wallet_transactions` closes it without inventing a gateway
  record. **This is the cheap half of A-5 that was deliberately left out.**
- [ ] `@claude` **A-11 · 🟡 · S — Two paths still bypass the `order.paid.v1` rule**
  Found while writing A-5's rule down. (a) With `EVENTS_ENABLED=false` the legacy lever
  is `payment_loyalty_awards` (`payments/service.go:443`), which the wallet rail never
  writes — so on the fallback path wallet buyers still earn nothing. (b)
  `orderService.MarkOrderAsPaid` (`orders/service.go:900`) is an unrouted third paid
  path that emits no fact at all. Both are exactly what the written rule forbids;
  either wire them to the emitter or delete them.
- [ ] `@claude` **A-6 · 🟠 · S — Decide and document the replica story**
  Cron is in-process, rate limiting in-memory. Architected for one box; written down nowhere.
- [ ] `@claude` **A-7 · 🟠 · M — Make doc claims testable**
  Eight verified cases of "the comment asserts a runtime property the code lacks" in one
  subsystem. Rule: a comment claiming a runtime guarantee gets a test named after it, or
  the claim is deleted.
- [ ] `@claude` **A-8 · 🟠 · M — Harden the analytics write path (instead of a document-store migration)**
  Raised as "move analytics off Postgres to MongoDB, it'll get slow." The analytics DB is
  already **TimescaleDB** — hypertables, weekly chunks, a 30-day compression policy, and
  pre-aggregated `daily_*` rollups the dashboards read instead of raw events. Mongo would
  lose all four and gain nothing; **decision: do not migrate.** The real, verified risks:
  (1) `events` carries **six indexes including a GIN on `payload`** — write amplification
  on the hottest ingest path in the system; drop what nothing queries and prove the rest
  with `pg_stat_user_indexes`. (2) rollups are upserted from Go
  (`product_stats_repository.go`), not TimescaleDB continuous aggregates — a backfill or a
  missed cron leaves the dashboards silently wrong. (3) no retention policy on `events`,
  so compressed chunks accumulate forever. **Done when:** ingest indexes are justified by
  usage, rollups are either continuous aggregates or covered by a gap-detection test, and
  a retention policy exists. *If Timescale is ever genuinely outgrown the next stop is
  ClickHouse, not a document store — write that down here, not in a migration.*
- [ ] `@claude` **A-9 · 🟡 · S — `getStockLinesSQL` has no `GROUP BY`; latent, not live**
  Found while greening P1-2. `getStockLinesSQL` (`internal/features/orders/repository.go:446-449`)
  returns raw `order_items` rows with **no `GROUP BY product_variant_id`**, but
  `inventory_reservations` is unique on `(order_id, product_variant_id)` and the PR-020b
  backfill aggregates with `SUM`. So an order carrying two lines for one variant produces
  per-row `StockLine`s whose quantities can never match the single aggregated reservation
  row — `closeReservation`'s `quantity = $3` predicate misses, `Deduct` returns
  `ErrInvalidState`, and `Confirm` rolls back. **The customer has paid and the order will
  not confirm.** Same hazard on the `ReserveForOrderTx` side. Aggregate both by variant, or
  make the reservation row per-line. Needs a test with a duplicated variant line — no
  existing fixture builds that shape. **Verified not reachable today** (2026-08-17):
  `cart_items` is UNIQUE on `(cart_id, product_variant_id)` and merges on conflict, and
  the only writer of `order_items` is `BulkCreate(..., cartItems)` (`orders/service.go:320`)
  fed from those rows, with `order_items.product_variant_id` NOT NULL. So the shape cannot
  occur through the cart. Downgraded from 🔴 to 🟡 on that evidence. It goes live the moment
  a second order-creation path appears (subscription renewal, admin-created order, box), so
  fix the SQL or add a UNIQUE guard before adding one.

## A5 — Catalog & cache events

Detail in `refactor-workstreams/event-driven-and-capacity/TASKS.md`. All **`[claude]`** —
these emit inside catalog write transactions and carry ordering/revision-guard rules.
ED-020 (contract) → ED-021 (emit) → ED-023 (Redis bust) → ED-022 (Meili incremental) →
ED-024 (taxonomy fan-out) → ED-025/026.
**User-visible today:** a brand/category/tag rename refreshes neither the Meili document
nor the PDP payload; `AdjustStock` does not bust the product cache (60s stale stock); a
recipe rename leaves the old slug cached.

---

# Track B — Design system + storefront

## B1 — Design foundation (do before the UI work; each collapses many call sites)

- [x] `@claude` **D-1a · 🟠 · S — Define semantic status tokens + a Badge `tone` variant**
  Design decision: pick oklch values for success/warning/info/neutral that belong to the
  cellar palette, and add `tone` to the Badge cva. The current status colors are sRGB
  Tailwind ramps — the most saturated thing on any admin screen, reading as
  bootstrap-default beside the oklch palette.
- [x] `@grok` **D-1b · 🟠 · M — Replace 189 hardcoded palette colors with the new tokens**
  **Do:** after D-1a, grep for `emerald-|amber-|blue-|red-|slate-|zinc-|gray-` across
  `components/` and `features/` and replace each with the semantic token or a Badge
  `tone`. **Done when:** the grep returns only intentional exceptions, and a theme change
  reaches every status surface.

- [ ] `@claude` **D-2 · 🟠 · M — Unify money formatting**
  A gift card issued at `125000.50` renders «۱۲۵٬۰۰۰٫۵ تومان» to the admin and
  «۱۲۵٬۰۰۱ تومان» to the customer who owns it — the exact float-rounding hazard
  `formatPaymentAmount` was written to prevent. **Correctness, not consistency.**

- [x] `@grok` **D-3 · 🟠 · M — Set `components.json` `rtl:true`; convert 81 physical direction utilities**
  **Files:** `components.json`, `components/ui/*`
  **Do:** set `"rtl": true` (with `rtl:false` every future `shadcn add` emits LTR
  components). Then convert physical→logical in `components/ui`: `ml-`→`ms-`,
  `mr-`→`me-`, `pl-`→`ps-`, `pr-`→`pe-`, `left-`→`start-`, `right-`→`end-`,
  `text-left`→`text-start`, `text-right`→`text-end`.
  **Highest-reach case:** `TableHead`'s `text-left` left-aligns every column header while
  its data cells are right-aligned — across eight admin tables.
  **Done when:** no physical direction utility remains in `components/ui`, and admin table
  headers sit over their own columns.

- [x] `@grok` **D-4 · 🟡 · S — Deduplicate the status label maps**
  **Do:** a shopper is told their review is «در انتظار تأیید»; the moderator sees «در
  انتظار بازبینی» for the same record. A gift card is «باطل‌شده» in admin and «غیرفعال»
  to its holder. Find every status→label map, pick one wording per state, put it in one
  module per domain, delete the copies. Land with D-1b.

- [x] `@grok` **D-5 · 🟡 · S — One Persian/Arabic digit normalizer**
  **Do:** normalization differs per feature — an Arabic-keyboard phone number is
  normalized in the inventory form and passed raw in the customer form; a value copied
  out of the loyalty ledger cannot be pasted into the adjust form. Working versions exist
  at `features/customers/validations.ts:80-84` and
  `features/admin/inventory/validations.ts:8-13`. Promote one to `lib/`, handling both
  Persian (۰-۹) and Arabic-Indic (٠-٩) ranges, and use it at every numeric input.
  **Done when:** any numeric field accepts Persian, Arabic-Indic and ASCII digits.

- [x] `@grok` **D-6 · 🟡 · S — Route shadcn primitives through `--elev-*`**
  **Do:** the tuned two-mode elevation scale is bypassed exactly where depth matters —
  over the `#140e0a` background a 10%-black default shadow contributes nothing, so
  dialogs, sheets, dropdowns and selects are flat. Replace `shadow-sm/md/lg` in
  `components/ui/{dialog,sheet,dropdown-menu,select,popover,card}.tsx` with
  `shadow-e1/e2/e3`. **Done when:** overlays read as raised in dark mode.

- [x] `@grok` **D-7 · 🟡 · S — Fix the motion token; `duration-cellar` never compiled**
  **Files:** `app/globals.css` (`@theme` block)
  **Do:** the stylesheet advertises calm premium easing that reaches six storefront cards
  and nothing else — every modal/sheet/dropdown snaps open in 100ms with generic easing.
  `--animate-duration` does not produce a `duration-cellar` utility in Tailwind v4;
  declare it so it compiles, apply `ease-cellar duration-cellar` to the overlay
  primitives, fix the two card easing outliers (one hardcoded copy, one browser default),
  and add `prefers-reduced-motion` guards on `.hover-lift`.

- [x] `@grok` **D-8 · 🟡 · M — Stop applying Markazi Text at UI sizes**
  **Do:** the display serif is forced onto every `h1`–`h4` and four primitives. Markazi's
  glyphs occupy a small share of the em, so a `CardTitle` at 16px optically reads at or
  below the 14px Vazirmatn body it heads — cards and dialogs lose hierarchy. Restrict
  `--font-heading` to display sizes (`text-3xl`+); let `CardTitle`, `DialogTitle` and
  small headings use the sans. **Done when:** a card title is visibly larger than its body.

- [x] `@grok` **D-9 · 🟡 · M — Extract `ListPagination`**
  **Do:** 22 list screens hand-roll the same قبلی/بعدی control with drifted a11y and
  sub-44px touch targets. Build one component (44px targets, `aria-label`s, disabled
  states, page-count display), replace all 22. **Done when:** pagination is identical
  everywhere and no copy remains.

- [x] `@grok` **D-10 · 🟡 · M — Merge `EmptyState` and `Placeholder`**
  **Do:** an empty *search result* on the storefront gets the deliberately-unfinished
  scaffold treatment (flat muted medallion, sans title) while an empty account page gets
  the editorial one (gold medallion, serif). Keep the editorial one, delete the scaffold,
  migrate call sites.

- [x] `@grok` **D-11 · 🟡 · S — Deduplicate the card hover treatment onto `.hover-lift`**
  Three near-copies disagreeing on easing and which properties animate, on the
  storefront's core visual unit — product, recipe and journal cards each feel different.

- [x] `@grok` **D-12 · 🟡 · S — Align PWA/browser `theme-color` with the real dark background**
  **Files:** `app/manifest.ts`, `app/layout.tsx` · A visible seam across the top of every
  screen on mobile Chrome and in the installed PWA.

## B2 — Storefront conversion

- [x] `@claude` **U-1 · 🔴 · M — Show the wallet balance at checkout; branch the confirmation CTA on payment status**
  Wallet is **preselected**. The most likely first purchase — an empty wallet — becomes an
  order that is never paid, on a screen that names the remedy in prose and offers **no
  button**. Money left uncollected.
- [x] `@grok` **U-2 · 🟠 · S — Put the payable total above the place-order button on mobile**
  At 375px the shopper picks shipping and taps «ادامه» without seeing what it added, then
  commits before the total scrolls into view. Move the discount/shipping/gift breakdown
  and grand total above the CTA at `sm` and below.
- [ ] `@claude` **U-3 · 🟠 · M — Per-line availability in the cart; cap the quantity stepper**
  A sold-out line looks fully buyable and fails only at «ثبت و پرداخت». *Needs backend:*
  stock on the cart item projection.
- [ ] `@claude` **U-4 · 🟠 · M — Stop stripping campaign params from `/products`; expose the search box the parser supports**
  Every paid click to the main catalogue loses attribution and eats a redirect before
  first paint.
- [x] `@grok` **U-5 · 🟠 · S — Render the place-order failure next to the button that failed**
  Currently hundreds of pixels above the viewport on a multi-line order, with an
  auto-dismissing toast as the only other signal. Render the persistent error immediately
  above the CTA and scroll it into view.
- [x] `@grok` **U-6 · 🟡 · S — Paginate site search; print the real count**
  A broad query always reports «۲۴ نتیجه» regardless of catalogue size, shows 24 cards
  and stops. A factual falsehood on the highest-intent surface. Use the real total from
  the API and add pagination.
- [x] `@grok` **U-7 · 🟡 · S — Make restock-notify the primary action on an out-of-stock PDP**
  Including the mobile sticky bar — today the only recoverable outcome of an out-of-stock
  visit is hidden behind an unlabelled dropdown.
- [ ] `@claude` **U-8 · 🟡 · M — Replay the add-to-cart intent after a login bounce**
- [x] `@grok` **U-9 · 🟡 · S — Use the existing Jalali input for the gift delivery date**
  **Files:** gift checkout form, `components/ui/jalali-datetime-input.tsx`
  The shopper picks a Gregorian date and the confirmation answers in Jalali — two
  calendars in one transaction, on the highest-AOV flow. The component already exists.
- [x] `@grok` **U-10 · 🟡 · S — Delete the "newsletter not connected" block closing the homepage**
- [x] `@grok` **U-11 · 🟡 · S — Fix RTL centering of the PDP gallery image counter**
- [x] `@grok` **U-12 · 🟡 · S — `/products` filter chips need a 44px coarse-pointer height**

## B3 — Accessibility

- [x] `@grok` **AC-1 · 🟠 · S — Announce the cart item count**
  The static `aria-label` discards the badge, so a screen-reader user hears «سبد خرید»
  whether the cart holds 0 or 9 items, and adding announces nothing. Put the count in the
  accessible name and add an `aria-live="polite"` region for changes.
- [x] `@grok` **AC-2 · 🟡 · S — Mobile nav drawer reserves clearance on the wrong side**
  `pr-16` carves 4rem out of the right edge where nothing sits, while the close X on the
  left has only `p-4`. Swap to logical `pe-`/`ps-` matching the button's real position.

## B4 — Performance

- [x] `@grok` **PF-1 · 🟠 · M — Delete Swiper from the home page**
  ≈100 kB min (~33 kB gz) plus four stylesheets on the most-visited route, blocking
  hydration, **for behaviour the same page already implements in pure CSS 200 lines
  away**. Port the remaining carousel to that pattern and drop the dependency.
- [x] `@grok` **PF-2 · 🟠 · S — Replace the `motion`-powered `Reveal` with CSS**
  Pulls the full motion runtime into the shared chunk on 15 storefront pages for a
  fade-up, and converts pure server markup into hydration work. Reimplement with a CSS
  animation + `IntersectionObserver`, honouring `prefers-reduced-motion`.
- [x] `@grok` **PF-3 · 🟡 · S — Move `Geist_Mono` out of the root layout** — preloaded on
  every public page, used only in admin.
- [ ] `@claude` **PF-4 · 🟡 · M — Suspense boundaries on `/products` and `/search`**
  *Do after P0-7 — value drops sharply once home and PDP prerender.*

---

# Track C — Admin dashboard redesign

54 findings. The panel is **structurally sound** — the product editor has real
unsaved-change protection with sessionStorage recovery, shipping is genuinely well
designed, RBAC gates render. The problem is that it is organised around the *catalogue of
modules* rather than around the operator's day.

## C1 — Shell and information architecture

- [x] `@claude` **S-1 · 🔴 · L — The landing page is a second analytics page, not a work queue**
  The first screen of the day reports revenue and then makes the operator visit four
  other screens to discover whether anything is waiting. Replace with action tiles that
  each link into a pre-filtered list: pending orders, reviews awaiting moderation, low
  stock, failed payments, unfulfilled paid orders. Nothing on the current page is a task.
- [x] `@claude` **S-2 · 🟠 · L — There is no page shell — four incompatible list patterns**
  Muscle memory does not transfer: products needs «اعمال», coupons searches by itself,
  pagination sits bottom-start on one screen and bottom-end on another. Build one
  `AdminPage` (breadcrumb, title, primary action, filter bar, content, pagination) and
  migrate every list. **Foundation for S-3, S-6, S-9.**
- [ ] `@claude` **S-3 · 🟠 · M — Applying a filter costs a full page navigation on the four busiest lists**
  Order triage is a status-toggling loop paying a server round trip per hop.
  `coupons-board.tsx:145-172` already does it right — lift that into a `useFilterParams`
  hook (selects on change, text on ~300ms debounce, `router.replace`), add removable
  filter chips, and a saved-view action.
- [x] `@grok` **S-4 · 🟠 · M — Sidebar: add counts, regroup by job, collapse setup**
  **Files:** `lib/rbac/nav.ts:48-236`, `features/dashboard/components/dashboard-nav.tsx:33-82`
  **Do:** 23 items in 8 module-shaped groups, no counts, always expanded, needing an inner
  scrollbar at 1366×768. Add `badge?: number` to `NavItem` and render it end-aligned, fed
  by the same counts as S-1. Regroup: امروز / کار روزانه (orders, payments, reviews,
  inventory) / کاتالوگ / مشتریان / بازاریابی و محتوا / پیکربندی — the last collapsed by
  default with state in localStorage. **Done when:** the nav fits a 768px-tall viewport
  without an inner scrollbar and shows pending counts.
- [x] `@grok` **S-5 · 🟠 · S — The command palette rejects the Persian digits the panel prints**
  **Files:** `features/dashboard/components/admin-command-search.ts:10-12,29-34`
  **Do:** the panel renders «#۱۴۲» via `Intl.NumberFormat('fa-IR')`, but
  `parseOrderIdQuery` uses `/^\d{1,12}$/`, which matches ASCII only — so pasting the
  number back matches nothing. Call the digit normalizer (D-5) at the top of
  `normalizeCommandQuery`. Then stop treating every digit string as an order id: ≤8 digits
  → order; 10–11 digits starting 0 or 9 → customer-by-phone via the existing
  `searchAdminCustomers`, suppressing the bogus order row (today `09121234567` offers
  «سفارش #۹۱۲۱۲۳۴۵۶۷», an order that does not exist).
  **Done when:** «۱۴۲» finds order 142 and a mobile number finds the customer.
- [x] `@grok` **S-6 · 🟡 · M — ~280px of chrome above the first row of every list**
  Nine visible rows on a 1080p laptop, five on 1366×768. Collapse the page header and the
  bordered filter card into one bar (title ~20px + primary action inline-end, filters in a
  row beneath — no card, no «جستجو و فیلتر محصولات» heading, no icon). Move standing
  instructions into a dismissible popover. Target ≤140px. **Depends on S-2.**
  ⚠ One of those paragraphs is already stale — it tells the operator to use a
  «وزن بسته‌بندی» filter that does not exist on the form beneath it.
- [x] `@grok` **S-7 · 🟡 · M — Command palette reaches 2 of ~20 entities and runs no commands**
  Add sources behind the existing `fetchAdminList` helper: inventory by SKU (the
  inventory search already accepts SKU), coupons by code, journal + recipes by title. Add
  a «دستورها» group of permission-gated actions — محصول جدید، کد تخفیف جدید، صدور کارت
  هدیه، نوشتهٔ جدید. **Depends on S-5.**
- [x] `@grok` **S-8 · 🟡 · S — Delete the "quick operational access" card grid**
  Six `min-h-40` cards take ~500px of the fold and five parallel API calls to report how
  many *tags* exist. Products, orders and inventory — the three daily jobs — are absent.
  Delete when S-1 lands, carrying پرداخت‌های در انتظار (which does link correctly) into
  the new tiles.
- [x] `@grok` **S-9 · 🟡 · S — Moderation queue state lives in React state, not the URL**
  Refreshing after approving a batch drops back to page 1; back exits the panel; every tab
  switch unmounts the tab bar under the operator's cursor. Move `tab`/`page` to search
  params, add `placeholderData: keepPreviousData`, and link the product name to its
  product page. **Done when:** `/admin/reviews?status=pending&page=2` is linkable — which
  S-1's tile and S-4's badge both need.
- [x] `@grok` **S-10 · 🟡 · S — ⌘K and search do not exist below 1024px**
  The header carrying `AdminCommandMenu` is `hidden lg:flex`, and the ⌘K listener is
  registered *inside* it — so on a tablet in portrait there is no search at all and no
  page title. Render the menu in both bars (icon-button on the compact one) and move the
  keydown registration up into `DashboardShell`.
- [x] `@grok` **S-11 · 🟡 · S — Content column capped at 1248px on table-heavy screens**
  ~420px of empty gutter per list on a 1920px monitor — exactly the room the products
  table needs for SKU and stock, and orders for the customer name. Add
  `<AdminPage width="wide">`, default list routes to it, keep the cap for forms.
  **Depends on S-2.**

## C2 — Product editor

- [ ] `@claude` **PE-1 · 🔴 · L — The variant matrix is an accordion; the bulk generator abandons the operator**
  The generator builds up to 100 combinations all sharing one price with no SKU and no
  stock — then differentiating them is N open/edit/close cycles over three inputs each. A
  column header row already exists, so the layout is pretending to be a table. Make it
  one: read-only option columns, inline-editable SKU/price/compare-at/stock/active, row
  selection with "apply to selected", "fill down", keyboard cell traversal, SKU
  auto-generated from the product code + option slugs, and a preview step to deselect
  combinations that do not exist.
- [ ] `@claude` **PE-2 · 🔴 · M — Break the 409 dead end**
  An operator editing a product a colleague touched has **no path from conflict to a saved
  product** — variants, options, tags and staged images are all lost, and the panel invites
  the retry that cannot succeed. Refresh the revision and re-apply.
- [x] `@grok` **PE-3 · 🟠 · S — Section jump links fire the unsaved-changes dialog instead of jumping**
  **Files:** `ProductForm.tsx:310-347`, `SectionNav.tsx:37-38`
  **Do:** the capturing navigation guard matches any `a[href]`, and «پرش سریع» renders
  `<a href="#...">` — so a hash link always looks like navigation and pops the discard
  alert instead of scrolling. After resolving `destination`, return early when
  `destination.pathname === location.pathname && destination.search === location.search`.
  Then intercept the click properly: `scrollIntoView({behavior:"smooth"})`, force-open the
  target section if collapsed, and drive an active-section highlight from an
  `IntersectionObserver`.
  **Done when:** clicking a section link on a dirty form scrolls instead of warning.
  *Repeatedly showing a discard dialog for a harmless action trains operators to dismiss
  it reflexively — which is exactly when it will eat real work.*
- [ ] `@claude` **PE-4 · 🟠 · M — Brand/category selects cap at 100 with client-only search**
  Two failures: a product cannot be assigned brand #101 (search says «موردی یافت نشد»),
  **and** an existing product whose brand is outside page one renders as «انتخاب برند» —
  the edit screen says the product has no brand when it does. The value still submits, so
  the lie stays invisible until someone "fixes" it and overwrites real data. Needs an
  async mode seeded with the selected entity fetched by id.
- [ ] `@claude` **PE-5 · 🟠 · L — One six-section scroll with no addressable position**
  Changing a price — the highest-frequency task in the back office — is a page load plus a
  scroll past an always-expanded 8-field general section. Add `?tab=` search-param
  sections over the existing single component (route segments would remount and lose RHF
  state).
- [ ] `@claude` **PE-6 · 🟠 · M — Nothing validates until Save, then one sentence and no list**
  After filling a 64-variant product the operator learns nothing is wrong until submit,
  then gets one sentence and a jump to whichever bad field happens to be first. Needs an
  error summary with jump-to-field.
- [x] `@grok` **PE-7 · 🟠 · M — No duplicate, no seeded create**
  **Do:** twenty bottles from one distributor share brand, category, origin, weight band,
  tags, option types and usually a price ladder — today that is twenty complete traversals.
  Add a «تکثیر» action on the products list and in the editor that opens the create form
  pre-filled from an existing product (everything except name, slug, SKU and images).
  ⚠ `ProductsTable.test.tsx:82` actively asserts a duplicate control does **not** exist —
  that test was written deliberately and must be updated, not worked around.
- [ ] `@claude` **PE-8 · 🟠 · L — Image management is a one-column list of 56px thumbnails**
  Two competing notions of "the main image", and `ImageUploader` silently drops the
  `onGalleryChange` prop that `ImagesSection` passes — so the sidebar cover thumbnail and
  the "N تصویر" summary never update. Needs a grid, larger previews, drag-reorder, and one
  unambiguous primary.
- [x] `@grok` **PE-9 · 🟡 · M — Draft mode does not relax validation**
  `is_active=false` saves and appears under the پیش‌نویس filter, but is validated exactly
  as strictly as a live product — so one unpriced variant blocks parking a half-known
  product. Relax variant/SEO requirements when `is_active` is false; keep them for publish.
- [x] `@grok` **PE-10 · 🟡 · M — Save freezes the whole form for the length of the uploads**
  Eight fresh photos greys out every field with no cancel and a `beforeunload` guard. Keep
  fields editable, show per-image upload progress, and on failure leave the form usable.
- [ ] `@claude` **PE-11 · 🟡 · M — Stock is shown but cannot be set, and there is no route to inventory**
  Stocking a new product means saving, navigating to inventory, searching, identifying each
  variant by SKU and adjusting one at a time. *Per-variant images need a backend contract
  change too — `SaveProductImageInput` cannot express the association.*
- [x] `@grok` **PE-12 · 🟡 · S — Every keystroke in any variant field re-renders all rows**
  At 64 rows each re-reconciles a Collapsible and up to three mounted Selects. Memoize the
  row and subscribe per-field rather than to the whole array.

## C3 — Content editors (recipes + journal)

- [x] `@claude` **CE-1 · 🔴 · L — No preview anywhere; publishing is the only way to see the page**
  An author writing a 900-word tasting note cannot see one rendered heading or blockquote
  before it is live.
- [ ] `@claude` **CE-2 · 🔴 · M — No autosave, no unsaved guard, no draft recovery**
  In the two editors holding the longest-lived work. A 40-minute post lives entirely in
  React state — one mis-aimed click on «انصراف» or a sidebar link and it is gone.
  `ProductForm` carries a complete guard that was never extracted.
- [x] `@grok` **CE-3 · 🔴 · M — Recipe ingredients cannot link to a catalogue product**
  **Files:** `features/recipes/validations.ts:38` (`product_variant_id` already declared),
  recipe ingredient rows
  **Do:** the field exists in the schema and the storefront reads it, but there is no UI —
  so the shoppable-ingredient feature is dead. Add a product/variant picker per ingredient
  row (reuse `SearchableIdSelect`). **Done when:** an ingredient saved with a variant id
  renders as shoppable on the storefront. *This is the most commercially valuable thing on
  a recipe page.*
- [ ] `@claude` **CE-4 · 🟠 · L — The body editor cannot insert an image, table or product mention**
  The renderer supports all three. A journal post can carry exactly one image — its cover.
- [ ] `@claude` **CE-5 · 🟠 · L — Recipe method is one free-text blob, reverse-engineered by regex**
  Ingredients are structured and steps are not — backwards for the half Google indexes as
  `HowToStep`.
- [x] `@grok` **CE-6 · 🟠 · M — The recipes board is a dead end past 60 items**
  **Do:** no search, no status filter, no pagination — past 60 recipes the older ones are
  invisible from the admin entirely. The journal board has all three; port that pattern.
- [ ] `@claude` **CE-7 · 🟠 · M — Slug rename silently breaks every inbound link**
  And the recipe editor's hint actively encourages it. Needs a redirect record, not just a
  warning dialog.
- [x] `@grok` **CE-8 · 🟡 · M — No publish workflow: no scheduling, no confirm on unpublish**
  The backend field for scheduled publish already exists. Add a date-time (Jalali) field, a
  confirm when pulling a live post down, and a clear published/draft/scheduled indicator.
- [x] `@grok` **CE-9 · 🟡 · M — SEO fields are bare inputs**
  Add character counters with the real truncation points (~60 title, ~155 description), a
  Google-style preview, and disclosure of what the fallback is when empty. Two recipe SEO
  fields the storefront reads have no input at all.
- [ ] `@claude` **CE-10 · 🟡 · M — One cover image per item, no media library, journal has no OG image**
- [x] `@grok` **CE-11 · 🟡 · S — Two editors, two idioms**
  The same field behaves differently depending on the screen — excerpt limits, slug hints,
  save/cancel placement. Align them on one pattern.

## C4 — Commerce forms and detail screens

- [x] `@claude` **CF-1 · 🔴 · L — Orders and customers cannot reach each other**
  The orders list has no buyer column, and its only customer filter is an id the customer
  page does not display. Triaging a morning is N page loads instead of one scan, and the
  round trip an operator improvises for an inbound call is impossible. *Needs backend:
  customer identity on the admin order list item.*
- [x] `@claude` **CF-2 · 🔴 · M — Coupon product scope caps at the first 100 products**
  A coupon can never be scoped to product #101+ — the operator searches, finds nothing,
  and scopes to a whole category instead, **over-discounting**. And scope set outside that
  window is invisible in the UI while staying live in the backend. Same root cause as PE-4.
- [ ] `@claude` **CF-3 · 🟠 · L — Customer detail is an identity card, not a customer record**
  No orders, no wallet balance, no loyalty — and money is minted with no balance in view.
  This is the screen opened when a customer calls, and it answers none of the questions a
  customer asks.
- [x] `@grok` **CF-4 · 🟠 · M — Order detail buries the money and has no timeline**
  **Do:** the first thing on a wide screen is a duplicated name and a postal address; the
  total, items and payment state are a scroll away, and the payment card omits the amount
  and paid-at date the order already carries. Restructure: money + status + items first,
  address secondary, and add a status timeline from the data already returned.
- [ ] `@claude` **CF-5 · 🟠 · M — Ten forms silently destroy unsaved work**
  `ProductForm` alone carries a complete navigation guard that was never extracted. The
  coupon form has fourteen fields including two Jalali datetimes and a scope picker.
- [x] `@grok` **CF-6 · 🟠 · M — The admin reads Jalali and writes Gregorian**
  **Files:** six native `<input type="date">` sites; `components/ui/jalali-datetime-input.tsx`
  **Do:** the console shows ۱۴۰۴/۰۵/۱۸ everywhere then asks the operator to type
  2025-08-09. Replace every native date input with the existing Jalali component (used in
  exactly one form today). **Done when:** no native date input remains in admin.
- [x] `@grok` **CF-7 · 🟠 · M — Coupon money fields are unlabelled and there is no preview**
  **Do:** Toman/Rial is a factor-of-ten error and nothing catches it — «حداقل مبلغ سفارش»
  has no unit, no thousands grouping, no preview. Add the unit suffix, live Persian
  thousands grouping, and a plain-language summary («۱۰٪ تخفیف تا سقف ۵۰٬۰۰۰ تومان برای
  سفارش‌های بالای ۵۰۰٬۰۰۰ تومان»).
- [x] `@grok` **CF-8 · 🟠 · S — Option values delete on one click with no confirmation**
  The widest blast radius in the admin is the only unguarded action — and dangerous
  precisely because it is the exception. Add an `AlertDialog` naming what will be lost.
  *Also add confirms to the variant-grid delete and the order status→delivered select.*
- [x] `@grok` **CF-9 · 🟠 · M — Translate server errors panel-wide**
  Persian on every happy path, English at exactly the moment the operator must act.
  «coupon code is already used by another coupon» leaves them with no next step. Build one
  error-code→Persian map and route every mutation's error through it.
- [x] `@grok` **CF-10 · 🟡 · S — Settings save errors can land in a hidden tab**
  Edit SEO, switch to Store, save, get one red toast — the error sits on a panel they
  cannot see and both tab labels look fine. Mark the failing tab and focus it.
- [x] `@grok` **CF-11 · 🟡 · S — No quick-create anywhere; gift cards has no create route**
  Creating a coupon is three navigations and two page loads, repeated dozens of times a
  day. Covered partly by S-7's action rows; gift cards additionally needs the route.
- [x] `@grok` **CF-12 · 🟡 · M — Inventory toolbar filters claim to cover the whole warehouse**
  Filtering to «وزن ناقص» shows 20 rows with two contradictory counts on screen. Either
  label them as page-local or push the facets server-side. *Full fix needs per-facet
  params on `GET /admin/inventory`.*
- [x] `@grok` **CF-13 · 🟡 · S — Show the data the products list already fetches**
  Thumbnail, stock and variant count are in the payload and not rendered, so identifying a
  bottle costs one navigation each. **Depends on S-11** for the width.
- [x] `@grok` **CF-14 · 🟡 · S — Sticky headers on the wide numeric tables**
  Past ten rows the operator cannot tell فیزیکی from رزرو from قابل فروش.
- [x] `@grok` **CF-15 · 🟡 · S — Remove developer copy from operator screens**
  The orders screen names an HTTP endpoint; empty inventory tells the operator to run
  `make seed`.
- [x] `@grok` **CF-16 · 🟡 · S — Stop navigating away from the product editor after save**
- [x] `@grok` **CF-17 · 🟡 · S — Let stock adjustments record a reason**
  `damage` is defined in the backend and unreachable from the UI, so the movement log can
  never answer "how much did we lose to breakage".
- [ ] `@claude` **CF-18 · 🟡 · L — Row selection and bulk actions, starting with inventory**
  A 40-bottle delivery costs 40 popovers and 40 server re-renders.

## C5 — Loyalty: make it a real, modular section

Containment is already good — **one** loyalty reference exists outside
`features/admin/loyalty/`. The gaps are capability and boundary, not entanglement.

- [x] `@claude` **L-1 · 🔴 · L — There is no programme editor at all**
  The operator cannot change the earn divisor, redeem value, signup/review/birthday/
  referral bonuses, birthday timezone, or any of the four tier thresholds. **Every
  commercial lever of the loyalty programme is unreachable**, and the page describes a
  configuration source it no longer uses.
- [ ] `@claude` **L-2 · 🟠 · M — The kill-switch is dropped at the type boundary**
  The feature-flag capability you asked for **is already built in the backend** and
  invisible in the UI — nothing in admin can set it. Plumb the flag through the type and
  add the control. *This is what makes "the whole section can be switched off" true.*
- [x] `@grok` **L-3 · 🟠 · M — Split the two jobs into two routes**
  **Do:** one route serves programme configuration *and* member lookup, so the daily
  lookup starts a full viewport down past config that changes a few times a year. Split
  into `/admin/loyalty` (members, default) and `/admin/loyalty/programme` (config, L-1).
- [ ] `@claude` **L-4 · 🟠 · L — The adjust note is collected, transmitted, echoed back and discarded**
  The ledger cannot answer "who granted this and why" — an investigator sees «تنظیم توسط
  پشتیبانی» and a truncated pair of UUIDs, with no resolvable staff member. Needs a
  backend column.
- [ ] `@claude` **L-5 · 🟠 · M — Loyalty is invisible from the customer file**
  The module exports no embeddable widget, so the screen where support actually starts
  shows nothing — no points, no tier, no recent activity. **This is the core of the
  modularity ask:** a self-contained widget other screens embed rather than reimplement.
- [x] `@grok` **L-6 · 🟡 · M — Members list is a fixed recency feed with a dead-end empty state**
  It can only answer "who moved most recently", and its empty state instructs an action
  the page provides no field for. Add search by name/phone and sort by balance/tier.
- [x] `@grok` **L-7 · 🟡 · S — Ledger has no reason filter**
  The query parameter is already plumbed on both sides. A member with a year of history
  has hundreds of `order_paid` rows; reconciling a dispute means paging through all of
  them. Add the filter control.
- [ ] `@claude` **L-8 · 🟡 · M — No loyalty permission exists**
  Point-minting rides on customer-edit, so anyone who can correct a phone number can mint
  unlimited points — and a loyalty specialist cannot be granted access without customer
  edit. Blocks granting or hiding the section independently.
- [ ] `@claude` **L-9 · 🟡 · L — No programme-level operational view**
  Points liability, tier distribution and birthday-job health are all invisible — the three
  questions a loyalty programme is actually managed by.
- [x] `@grok` **L-10 · 🟡 · S — Give the module an API client and cut its two outbound deps**
  **Do:** its only write path is a hand-rolled `fetch` inside a component, forked from
  `wallet-credit-form` — so nothing can be audited, mocked or feature-gated in one place.
  Create `features/admin/loyalty/api/`, move every call there. Then copy the two generic
  helpers it borrows from `features/customers` and de-duplicate the tier labels, so the
  directory can be lifted or flagged off on its own. **Done when:** deleting
  `features/customers` does not break the loyalty routes.

---

# Non-goals

- No microservices, no event sourcing, no CQRS.
- The browser is not an event client — no storefront WebSocket or SSE.
- No Meili storefront cutover (separate decision).
- Analytics page views stay on the in-process queue; drop-on-full is the contract.
- Money commands — reserve, deduct, wallet debit, refund, coupon burn — stay explicit SQL.
  **Events notify; they are never the ledger.**

---

# Split summary

| | grok | claude | total |
| --- | ---: | ---: | ---: |
| Phase 0 — Stop the bleeding | 7 | 2 | 9 |
| Phase 1 — Safety net | 2 | 3 | 5 |
| Track A — Backend / Kafka | 6 | 11 | 17 |
| Track B — Design + storefront | 24 | 7 | 31 |
| Track C — Admin dashboard | 35 | 27 | 62 |
| **Total** | **74** | **50** | **124** |

**Suggested start.** grok: P0-2 → P0-3 → P0-4 → P0-5 → P0-6 (one afternoon of token and
typography fixes that changes how the whole product feels). claude: P0-1 → P0-7 → P1-2,
then straight into K-1…K-5.
