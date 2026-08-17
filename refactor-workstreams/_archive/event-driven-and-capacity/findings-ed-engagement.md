# Findings — `ed-engagement`

**Agent:** ed-engagement  
**Workstream:** `event-driven-capacity-20260816`  
**Date:** 2026-08-16  
**Mode:** plan only (no application code)

Lane: loyalty, referrals, recommendations, analytics queue, reviews, alerts —
what should **consume domain events** vs stay on the **HTTP request path** or
**cron**. Analytics already has an in-process queue; this note says keep it.

Depends on `ed-platform` (generic outbox + envelope) and `ed-money` (`order.paid`
/ `order.refunded` producers). Do not invent a second Kafka bus or event-source
reviews. Do not reopen PH/PR unless a live gap is shown.

IDs: **ED-030+**. Letter later if a claimed task splits.

---

## What I inspected

| Area | Paths |
|------|--------|
| Charter | `refactor-workstreams/event-driven-and-capacity/CHARTER.md` |
| Loyalty | `internal/features/loyalty/service.go`, `docs/architecture/loyalty.md` |
| Referral | `internal/features/referral/service.go` |
| Payments earn | `internal/features/payments/service.go` Confirm + `ProcessPendingLoyaltyAwards`, `repository.go` earn intent |
| Wallet-paid create | `internal/features/orders/service.go` `settleWalletInTx` — **no earn / no recs** |
| Refund clawback | `internal/features/orders/refund.go` |
| Reviews earn | `internal/features/reviews/service.go` Create |
| Signup | `internal/features/auth/handler.go`, `auth/otp.go` |
| Recs | `internal/features/recommendations/{service,repository,doc}.go` |
| Cart recs | `internal/features/cart/service.go` `recordAddToCart` |
| Wishlist | `internal/features/wishlist/` — no recs hook |
| Analytics queue | `internal/analytics/queue.go`, `middlewares/analytics.go`, `features/analytics/event_service.go` |
| Cron | `internal/corn/{recommendation,loyalty_birthday,alert_check,stats,search,revenue}_job.go`, `bootstrap/container.go` `buildCron` |
| Notifications | `docs/architecture/notifications-kafka.md` — email already has outbox |
| Dual-DB ADR | `obsidian/11 Decisions/ADR Dual databases main and analytics.md` |

---

## Rule of thumb (this lane)

| Mechanism | Use when |
|-----------|----------|
| **Domain event consumer** (outbox → relay → idempotent handler) | Side effect after a **committed** business TX, must not fail money/stock, must survive process crash |
| **Request path** | Caller needs the result in the HTTP response, or the work is a cheap unique insert the user just caused |
| **Cron** | Calendar / batch rebuild / scan of “conditions now true”; safe to miss a tick |
| **In-process analytics queue** | High-volume HTTP telemetry; **drop-on-full is the product contract** |

Money paths stay explicit transactions (charter). Events notify; they are not
the loyalty ledger. Ledger `UNIQUE (reason, ref_type, ref_id)` is already the
consumer idempotency key.

---

## As-built side-effect map

```
payments.Confirm  (same TX: money + stock + payment_loyalty_awards)
  after commit:
    ProcessPendingLoyaltyAwards → AwardForOrder + referral.OnPaidOrder
    RecordPurchasesForOrder     → recs (log on fail; no durable intent)
    SendPaidOrderReceipt        → notification dispatcher (already outbox-capable)

orders.Create  payment_method=wallet  (same TX: debit + paid + deduct)
  after commit:
    clear cart + receipt email
    ★ no earn intent, no AwardForOrder, no OnPaidOrder, no recs purchase

reviews.Create  → AwardForReview (best-effort, ignore error)
auth register / OTP new user → AwardSignup (ignore error)
POST /loyalty/redeem → Spend + wallet Deposit (must stay sync)
POST /referrals/claim → pending row (must stay sync)
admin adjust / programme PUT → request path
orders.RefundOrder → ClawbackOrderEarn then status=refunded
  (refund command fails if clawback errors)

cart.AddItem / bulk → RecordAddToCart (request path, log on fail)
POST /recommendations/interactions → request path (FE + unknown product 404)

cron loyalty_birthday          daily 01:15 UTC
cron recommendation_refresh    daily 03:00 UTC  (window 30d, max 5000)
cron alert_check               every 15 minutes
cron product_stats / revenue / search_summary  daily ~02:15–02:45 UTC

analytics middleware → Queue.Push (10k, drop-on-full, 4 workers, batch 250 / 3s)
                       → EventService.FlushEvents → Timescale
```

`payment_loyalty_awards` is already a **narrow outbox** for order earn
(PR-003h). `ProcessPendingLoyaltyAwards` is **not** on the cron runner — only
Confirm calls it (and it sweeps *all* leftover rows, not just the current
order). Quiet shop → leftover rows sit until the next Confirm.

---

## Decision matrix

| Work | Today | Target | Why |
|------|--------|--------|-----|
| Loyalty **order earn** | Confirm post-commit + intent row | **Consume `order.paid`** | Crash after commit loses in-process retry; wallet checkout never inserts intent |
| Referral complete + both-side award | Same Confirm hook | **Same `order.paid` consumer** | Already coupled to earn intent; Award then Complete; idempotent per referral id |
| Recs **purchase** weight | Confirm post-commit, log-and-lose | **Consume `order.paid`** | No durable retry; wallet miss; BE already owns paid purchase (PR-050d) |
| Recs **add_to_cart** | `cart.AddItem` request path | **Stay request-path** | Cheap unique-per-UTC-day insert; losing one add is fine; not worth outbox |
| Recs **for-you / FBT / similar reads** | HTTP | **Stay HTTP** | Charter: browsers are not Kafka clients |
| Recs **profile refresh** | Daily cron | **Stay cron** | Batch rebuild of recently active users; not a per-event graph |
| Recs **POST /interactions** | HTTP | **Stay HTTP** | Explicit client signals (`view`, `search_click`, …) |
| Wishlist / review → recs weights | Types exist; services do not write | **Stay request-path** if ever wired | Same as add_to_cart; not outbox |
| Review **CRUD + moderation** | HTTP | **Stay HTTP** | User waits for 201 / admin PATCH |
| Loyalty **review bonus** | After insert, swallow error | **Stay request-path** (v1) | Idempotent per review id; create must not fail. Optional later consumer if retry matters |
| Loyalty **signup** | After user insert, swallow error | **Stay request-path** (v1) | Same. `user.created` consumer only if platform already emits it |
| Loyalty **redeem / admin adjust** | HTTP + idempotency | **Stay request-path** | Money; response is the new balance |
| Referral **claim / GET me** | HTTP | **Stay HTTP** | Validation errors must be 400 now |
| Loyalty **birthday** | Daily cron | **Stay cron** | Calendar in programme TZ; no domain event |
| Clawback on full refund | Inside `RefundOrder` (blocks refund) | **Consume `order.refunded`** once money emits it | Points must not fail wallet/restock. Helper is already idempotent |
| Alert **create / list / delete** | HTTP | **Stay HTTP** | Fail-closed restock rules need sync 409 |
| Alert **notify** | 15m cron → notification dispatcher | **Keep cron as source of truth** | Condition is “stock/price *now*”. Optional fast path on inventory/price events; cron remains catch-up |
| Analytics **HTTP ingest** | In-process queue | **Keep the queue** — do **not** fold into outbox | See below |
| Analytics **rollups** (product / search / revenue) | Daily cron | **Stay cron** | Yesterday’s Timescale aggregates |
| Reserved `loyalty_earned` / `loyalty_redeemed` | Schema only (loyalty.md §9) | Consumer may `Queue.Push` after ledger commit | Still fail-open; never the outbox |
| Receipt / alert / renewal **email** | `notifications.Dispatcher` | **Already the notification outbox** | Do not dual-write a domain-event email path |

---

## Live gap that events should close

**Wallet-paid `POST /orders` never earns and never writes recs purchase.**

`settleWalletInTx` marks paid + deducts and returns. Post-commit only clears
the cart (receipt is the handler). Confirm is the only producer of
`payment_loyalty_awards` and `RecordPurchasesForOrder`.

This is why engagement should **not** keep wiring more hooks on Confirm. One
`order.paid` event from **both** Confirm and wallet create; this lane consumes
it twice (loyalty+referral, recs). `ed-money` owns the emit.

---

## Analytics queue: keep it — do not fold into the domain outbox

The queue (`internal/analytics/queue.go`) is the right tool for storefront
telemetry:

1. **Volume** — middleware fires on almost every HTTP request (`page_viewed`
   default, plus product/recipe/blog/search/cart/order classifiers). Putting
   that in the main-DB outbox would dwarf money events and couple GET latency
   to an extra write.
2. **Loss policy** — drop-on-full, never block. Domain outbox is
   at-least-once durable. Those contracts contradict each other.
3. **Dual database** — ingest lands in **Timescale**, not main Postgres.
   Outbox rows live in the **main** TX. Folding would dual-write across DBs
   or smuggle analytics into the money transaction — both forbidden.
4. **Already off the request goroutine** — `async.Go("analytics.capture")` →
   `Queue.Push`. Workers batch 250 / 3s; shutdown drains. That matches
   “never hostage request latency.”

**What must not go through the queue as the only copy:** paid-order earn,
referral complete, recs purchase. Those are business facts; they belong on
the domain outbox (or the existing `payment_loyalty_awards` row until the
generic outbox exists).

**Optional later:** after a loyalty ledger commit, best-effort `Queue.Push`
of `loyalty_earned` / `loyalty_redeemed` (loyalty.md §9). Emitter must drop
on full. Do not block Award/Redeem.

---

## Proposed tasks (ED-030+)

Do **not** implement until claimed. `ed-platform` must exist before consumers
can subscribe; until then ED-032 is the only useful standalone.

### ED-030 — Loyalty + referral consume `order.paid`

- **be** · **P0** · **M** · needs `ed-money` emit + `ed-platform` outbox
- Consumer: `AwardForOrder` then `referral.OnPaidOrder` (same order as today).
- Idempotency: ledger unique + Complete-once row. Keep marking
  `payment_loyalty_awards.awarded_at` **or** retire that table once the
  generic outbox idempotency_key is `order:{id}:earn`.
- Confirm’s in-process retry can stay as a kick; it must not be the only path.
- **Must cover wallet-paid create** (live miss).
- Payment Confirm still never fails because earn failed.

### ED-031 — Recs purchase consume `order.paid`

- **be** · **P1** · **S** · same event as ED-030
- Call existing `RecordPurchasesForOrder` (already idempotent per
  `metadata.order_id` + UTC day).
- Gives durable retry that Confirm currently lacks (log-and-lose).
- Unpaid checkout and orderless Confirm (wallet top-up / gift buy) still
  must not write. FE `POST /interactions` `purchase` may remain but BE owns
  the paid signal.

### ED-032 — Earn-intent sweeper cron (until outbox is live)

- **be** · **P1** · **S** · no platform dep
- Register `ProcessPendingLoyaltyAwards` on the corn runner (docs already
  say “exported for a later cron hook”).
- Does **not** fix wallet checkout (no row). Does fix Confirm retry
  exhaustion on a quiet shop.
- Delete or idle this job when ED-030 consumers + generic outbox are live.

### ED-033 — Clawback consume `order.refunded`

- **be** · **P1** · **S** · needs money emit
- Move `ClawbackOrderEarn` off the refund command’s success path.
- Today `RefundOrder` returns an error if clawback fails **after** wallet
  credit / restock — points can block a money command. Events notify; they
  are not the ledger, and they must not be the refund gate.
- Stay on `RefundOrder` (request path) until the event exists — do not leave
  a window with no clawback.

### ED-034 — Keep analytics queue; optional business Push

- **be** · **P2** · **S**
- Document + enforce: HTTP capture stays `analytics.Queue`. No outbox rows
  for `page_viewed` / `product_viewed` / `search_performed`.
- Optional: after Award/Redeem ledger commit, `Queue.Push` reserved
  `loyalty_earned` / `loyalty_redeemed` payloads (fail-open).
- Rollup crons stay. Do not increment daily stats from consumers (double
  count vs yesterday’s job).

### ED-035 — Alerts stay cron; optional inventory fast path

- **be** · **P2** · **M** · fast path needs `ed-catalog` / money stock events
- Keep `alert_check` (15m, `FindPending` 500, notify then `notified_at`).
- Dispatcher already uses notification outbox when async — do not add a
  second email topic.
- Later: on `inventory.available` / `variant.price_changed`, run the same
  pending query **for that variant only**. Cron remains the backstop for
  missed events and admin price edits that never emit.

### ED-036 — Explicit non-consumers (docs / guardrails)

- **docs** · **P2** · **S**
- Stay request-path: redeem, claim, review CRUD, alert CRUD, recs GET,
  `POST /interactions`, add_to_cart hook, admin adjust, signup/review earn
  (v1).
- Stay cron: birthday, recs refresh, product/search/revenue rollups,
  idempotency cleanup (not this lane).
- Do not emit domain events from analytics middleware.
- Do not make FE subscribe to Kafka / SSE for points or recs (that is ED-040).

---

## Handoffs

| To | Need |
|----|------|
| `ed-platform` | Generic outbox envelope + relay. Engagement will **not** reuse `notification_outbox` topic rows for earn/recs (wrong consumer, email DLQ). Same *pattern*, new event types. |
| `ed-money` | Emit `order.paid` from Confirm **and** wallet `CreateOrder`. Emit `order.refunded` after refund TX commits. Payload: `order_id`, `user_id`, `amount` (settled). |
| `ed-catalog` | If ED-035 fast path: variant restock / price-drop events. Not required for v1. |
| `ed-frontend` | No contract change. Points/recs/alerts stay HTTP. Eventual earn after pay is already the product rule (Confirm never waits on loyalty). Wallet-pay earn appearing after a short delay is new only if we fix the miss. |

---

## Out of scope / not bugs here

- Taste not blended into ForYou (PR-052a leftover) — not an event problem.
- Review images / unlike / list LIMITs — production-readiness, not ED.
- Notification OTP / receipt / gift email — already dispatcher + outbox.
- Subscription renewal scan — cron + dispatcher; money lane if auto-charge returns.
- Meili reindex — `ed-catalog`.
- Reservation TTL — money/orders.
- Analytics `page_viewed` over-capture (admin/health) — capacity hygiene, not a consumer.

No application code changed.
