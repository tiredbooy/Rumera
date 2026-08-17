# Event-driven — remaining reference detail

**Workstream:** `event-driven-capacity-20260816` · **Trimmed:** 2026-08-17

> **The assignable board is `/TASKS.md` at the repo root.** This file keeps only the
> design detail behind the remaining event tasks, so the root board can stay short.
> Everything shipped is recorded in `FINISHED.md`; completed entries have been
> removed from this file rather than left as noise.

**Shipped already** (see `FINISHED.md`): ED-000, 001, 002, 003, 003b, 004, 004b, 005,
007 (adapter only), 009, 010a, 010b, 010c, 011a, 011b, 012a, 030, 031.

---

## Charter (still binding)

The **customer API stays HTTP + JSON**. Browsers and Next.js are not event clients.
After a **committed** business transaction the API writes a domain fact to the outbox
**in the same Postgres transaction**; idempotent consumers do the side work.

Money paths — reserve, pay, refund, wallet debit, coupon burn — stay **explicit
transactions**. Events notify; they are never the ledger.

**Not this:** event sourcing, CQRS, microservices, checkout saga choreography,
WebSocket-everything.

---

## Remaining money facts

- **ED-011c — Gift fulfil email via the TX outbox** · P1 · S
  `giftcard.FulfillPaidPurchaseTx` calls `notifyPurchased` on the **pool** while the
  Confirm transaction is still open, so a rollback can still email a code for a card
  that never committed. `EnqueueTx` now exists. Care needed: the surrounding retry loop
  reuses one `pgx.Tx` with no savepoints, so once a statement errors the transaction is
  in state 25P02 and every later statement on it fails.

- **ED-014a — Paid analytics from `order.paid.v1`, not unpaid `POST /orders`** · P1 · S
  `middlewares/analytics.go` classifies every create as `order_created`, and
  `stats_job` counts those as purchases and revenue — including pending gateway orders
  that were never paid. Revenue reporting is currently inflated.

- **ED-015a — Reservation TTL: expire + release + fail-payment in ONE transaction** · P1 · M
  ⚠ This is a **money-command rewrite**, not an event task; the emit is the trivial
  half. `expireOne` currently CAS-fails the order, then separately releases stock and
  fails payments across four connections — status can flip while stock stays committed.
  Claim it standalone with partial-failure, double-expiry and concurrent-pay-vs-expire
  tests before adding the fact.
- **ED-015b — Customer notice on TTL expire** · P2 · S — consumer of `reservation.expired.v1`.

- **ED-016a — `order.cancelled.v1` + `order.refunded.v1`** · P1 · M
  Owns `order.refunded.v1`. Refund/cancel SQL stays the command — wallet credit,
  restock and clawback are not choreographed.
- **ED-017a — `payment.failed.v1`** · P2 · S — prefer unifying webhook fail + release
  into one transaction first (three connections today).

- **ED-033 — Clawback consumes `order.refunded`** · P1 · S
  Today a clawback failure makes `RefundOrder` return an error **after** the wallet
  credit and restock already happened — loyalty points can block a money command. Keep
  the request-path hook until the consumer is live; leave no gap.

---

## Remaining catalog / cache — the next real event win

Full analysis in `findings-ed-catalog.md`. User-visible staleness today.

- **ED-020 — Catalog event contract** · P1 · M
  Entity, id, op, `updated_at`/revision; **consumers re-read Postgres**. Idempotency
  `{type}:{id}:{updated_at}` or the aggregate `operation_id`, so an aggregate replay
  produces no second event. Must state the revision guard: a late event must never
  overwrite newer state.
- **ED-021 — Emit from product aggregate / variant / tags in the write TX** · P1 · M
- **ED-022 — Incremental Meili upsert/delete** · P1 · M
  Needs a new `GetForSearchIndex(ids)`. Hard delete → `DeleteDocument`; unpublish
  (`is_active=false`) → **upsert**, not delete. Nightly `FullReindex` stays the
  backstop. No storefront search cutover.
- **ED-023 — Redis cache-bust consumer** · P1 · S
  `product:v1:{id}`, `category:v1:tree`, `recipe:v1:{slug}` **+ the old slug**. Fixes
  cross-instance staleness and crash-after-commit; TTL stays the degrade path.
- **ED-024 — Brand/category/tag/option fan-out to product IDs** · P1 · M
  A rename changes the Meili document and the PDP payload with **no** product-row
  write, so neither is refreshed today.
- **ED-025 — Media + recipe/blog/hero events** · P2 · M — recipe update must carry
  **both** slugs.
- **ED-026 — `inventory.stock_changed` → product cache only** · P2 · S
  `AdjustStock` and checkout reserve do not bust `product:v1:*`, so PDP stock is 60s
  stale. Do **not** put stock in Meili.

---

## Remaining capacity suite

- **K6-001 — Run the suite on a seeded box** · P0 · S — you run this. Separate machine
  from the app; `k6 inspect`, then smoke → search → `PROFILE=stress`. Record plateaus.
  Do **not** breakpoint on the app host.
- **K6-002 — Multi-user `TOKEN_FILE`, one JWT per VU** · P1 · M — a shared token
  measures lock contention, not N shoppers.
- **K6-003 — Checkout write profile, default off** · P2 · M — needs K6-002 plus a
  cleanup playbook (pending orders, reserved stock, wallet).
- **K6-004 — Outbox lag scenario** · P2 · S — assert lag stays under budget under
  stress, and that checkout still succeeds with the event worker stopped.

---

## Remaining platform

- **ED-006 — Cron taxonomy + register the loyalty earn sweeper** · P1 · S
  `ProcessPendingLoyaltyAwards` is still only called from Confirm. The taxonomy table
  must cover **every** file in `internal/corn` — including `subscription_renewal_email`,
  which every previous findings table missed.
- **ED-008b — Ops inspect surface for the DLQ** · P1 · S
  Golden-path and replay tests shipped; a read-only staff surface did not. SQL is in
  `docs/architecture/domain-events.md`. Must redact `data` by default.

---

## Frontend contract (unchanged, still binding)

- **ED-040 — Docs lock: the browser is not an event client** · P1 · S
- **ED-041 — Honest async copy** · P1 · S — OTP 202, password reset, "receipt shortly".
  Unpaid orders must **not** promise a receipt.
- **ED-042 — Next→Go ETag/304** · P2 · M — the 304-safety half first: `publicRequest`
  always calls `response.json()`, so a 304 currently throws.
- **ED-043 — Admin orders stay pull-HTTP** · P2 · S — first upgrade is a 15–30s
  visible-tab refetch, not a socket.
- **ED-044 — Loopback revalidate endpoint** · P2 · M · blocked on ED-023
  A Go cache-bust consumer **cannot** expire Next tags —
  `revalidateAfterAdminMutation` only runs in the Next process that handled the write.

---

## Explicit non-goals

- [x] Browser / Next is not a Kafka consumer; no storefront SSE or WebSocket
- [x] No event-sourced catalogue, wallet, payment or inventory ledger; no CQRS
- [x] Reserve / deduct / release / wallet debit / coupon burn are **never** consumers
- [x] Analytics page views stay on the in-process queue (drop-on-full is the contract)
- [x] Meili storefront cutover is a separate decision
- [x] `notification_outbox` stays the SMS/email **command** stream
- [x] Do not run k6 breakpoint on the same machine as the app
