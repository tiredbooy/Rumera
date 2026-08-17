# Findings — `ed-money`

**Agent:** ed-money  
**Workstream:** `event-driven-capacity-20260816`  
**Date:** 2026-08-16  
**Mode:** plan only (no application code)

Move money/stock **side effects** onto domain events **without** event-sourcing the ledger. Customer API stays HTTP + JSON.

---

## Invariants (do not violate)

From `CHARTER.md` and `apps/backend/docs/architecture/money-and-stock-sagas.md`:

| Stay in a Postgres TX (commands) | Become events + idempotent consumers |
|----------------------------------|--------------------------------------|
| Reserve on `POST /orders` | Paid receipt email |
| Confirm: payment succeeded + `MarkAsPaid` + **deduct** | Loyalty `AwardForOrder` |
| Wallet checkout: `PurchaseTx` + `MarkAsPaid` + **deduct** | Referral `OnPaidOrder` |
| Refund: wallet credit + restock (command, not choreography) | Inventory / revenue analytics |
| Fail/cancel/TTL **release** (stock identity) | Reservation TTL **notice** (email/SMS) |
| Coupon `FOR UPDATE` + usage row | Recs purchase signal (optional; ED-030 may own) |

**Not this lane:** event-sourcing `payment_transactions` / wallet ledger / `inventory_reservations`; CQRS for checkout reads; Kafka from the browser; deduct/release/debit as consumers; microservices.

**Do not reopen** closed PH-011 / PH-040 / PH-041 / PH-042 / PR-003h / PR-020a–o unless a **new** live gap is shown (wallet earn + same-TX outbox are new vs those closes).

---

## What I inspected

| Area | Paths |
|------|--------|
| Charter / board | `refactor-workstreams/event-driven-and-capacity/CHARTER.md`, `BOARD.md` |
| Sagas | `apps/backend/docs/architecture/money-and-stock-sagas.md`, `obsidian/02 Architecture/Money and stock rules.md` |
| Notifications | `docs/architecture/notifications-kafka.md`, `internal/notifications/{dispatcher,outbox,event}.go`, `postgres/store.go`, migration `20260804120000_notification_outbox.sql` |
| Orders | `features/orders/{service,handler,receipt,refund,expire_reservations,doc}.go` |
| Payments | `features/payments/{service,webhook,repository,doc}.go` |
| Inventory | `features/inventory/{service,reservation}.go` |
| Wallet | `features/wallet/service.go` |
| Loyalty / referral | `features/loyalty/service.go`, `features/referral/service.go`, `docs/architecture/loyalty.md` |
| Gift / coupons | `features/giftcard/service.go`, `features/coupons/` (usage stays in create TX) |
| Analytics / TTL cron | `middlewares/analytics.go`, `corn/{stats_job,revenue_job,reservation_ttl}.go` |
| Adjacent findings | `production-readiness/findings-be-loyalty-money.md`, `findings-be-money-ops.md` (historical; several PR-020 items now shipped) |

---

## As-built: ledger vs side effects

### Commands already transactional (keep)

**Place + reserve (+ coupon + wallet settle)** — one TX from `BeginTx` through reserve; wallet rail debits, marks paid, deducts before commit.

```222:336:apps/backend/internal/features/orders/service.go
	tx, err := s.orderRepo.BeginTx(ctx)
	// …
	if err = s.inventory.ReserveForOrderTx(ctx, tx, order.ID, reservation); err != nil {
		return nil, err
	}
	if req.PaymentMethod == models.PaymentMethodWallet {
		if err = s.settleWalletInTx(ctx, tx, userID, order, reservation); err != nil {
			return nil, err
		}
	} else if err = s.insertPendingPaymentTx(ctx, tx, order, userID, req.PaymentMethod); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
```

```369:382:apps/backend/internal/features/orders/service.go
	if err := s.wallet.PurchaseTx(ctx, tx, userID, order.TotalAmount, order.ID); err != nil {
		// …
	}
	if err := s.orderRepo.MarkAsPaid(ctx, tx, order.ID); err != nil {
		return fmt.Errorf("orderService.CreateOrder: mark paid: %w", err)
	}
	if err := s.inventory.DeductForOrderTx(ctx, tx, order.ID, lines); err != nil {
		return err
	}
```

**Gateway Confirm** — same TX: `Confirm` + `MarkAsPaid` + `DeductForOrderTx` + `InsertEarnIntent`. Deduct is bound to this order’s active `inventory_reservations` row (`reservation.go:30–36`, `service.go:282–304`).

```345:423:apps/backend/internal/features/payments/service.go
	tx, err := s.paymentRepo.BeginTx(ctx)
	// …
	if err = s.orderRepo.MarkAsPaid(ctx, tx, *pt.OrderID); err != nil { /* … */ }
	if err = s.inventory.DeductForOrderTx(ctx, tx, *pt.OrderID, items); err != nil {
		return nil, apperr.ErrInternal
	}
	// …
	if err = s.paymentRepo.InsertEarnIntent(ctx, tx, OrderEarnIntent{…}); err != nil {
		return nil, apperr.ErrInternal
	}
	if err = tx.Commit(ctx); err != nil {
```

**Unpaid cancel** — one TX: CAS cancel + coupon reverse + `ReleaseForOrderTx` (`orders/service.go:796–826`).

**Wallet debit primitive** — `PurchaseTx` does not begin/commit (`wallet/service.go:271–308`). Gateway top-up credits inside Confirm (`CreditGatewayTopUpTx` at `:141–163`). Admin credit is its own TX (`:88–100`).

These writes **are** the ledger. Events must not replace them.

### Side effects today (not same-TX outbox)

| Side effect | When | How it runs | Durable with domain write? |
|-------------|------|-------------|----------------------------|
| Receipt email | Confirm after commit; wallet-paid `CreateOrder` handler | `async.GoCtx` → `DispatchOrderConfirmed` | **No** |
| Loyalty + referral | Confirm after commit only | `ProcessPendingLoyaltyAwards` in-process retry | Intent row **yes** on Confirm; award **no**. Wallet path **no intent** |
| Recs purchase | Confirm after commit | `RecordPurchasesForOrder` log-on-fail | **No** |
| Gift code email | **Inside** Confirm TX | `DispatchGiftPurchased` on **pool** | **Worse than after-commit** (dual-write) |
| Analytics “purchase” | HTTP `POST /orders` 2xx | in-process queue → Timescale | Unpaid creates counted; crash/drop loses event |
| Reservation TTL | Cron flips status + release | no customer notice | Expire itself is **not** one TX |
| Refund clawback | Inside `RefundOrder` | sync, fail-closed | Keep as command (loyalty ledger), not a consumer of “maybe refunded” |

---

## Gaps (evidence)

### 1. Notification outbox cannot join the money TX

Docs promise “producers write outbox rows in the same transaction as domain changes” (`20260804120000_notification_outbox.sql:3–4`, `notifications-kafka.md:34–36`). Implementation uses the pool:

```24:29:apps/backend/internal/notifications/postgres/store.go
func (s *Store) Enqueue(ctx context.Context, topic, partitionKey, idempotencyKey string, payload []byte) error {
	const q = `
		INSERT INTO notification_outbox (topic, partition_key, payload, idempotency_key)
		VALUES ($1, $2, $3::jsonb, $4)
		ON CONFLICT (idempotency_key) DO NOTHING`
	_, err := s.db.Exec(ctx, q, topic, partitionKey, payload, idempotencyKey)
```

`OutboxStore.Enqueue` has no `pgx.Tx` (`notifications/outbox.go:21–24`). Envelope types are **notification.*** only (`event.go:15–21`). There is no `order.paid.v1` / `reservation.expired.v1`.

**Platform owns the TX API (ED-000+).** This lane specifies the money facts and will not invent a second bus.

### 2. Receipt is after-commit fire-and-forget, not outbox-in-TX

Confirm:

```421:436:apps/backend/internal/features/payments/service.go
	if err = tx.Commit(ctx); err != nil {
		return nil, apperr.ErrInternal
	}
	// Post-commit earn …
	s.sendPaidOrderReceipt(ctx, *pt.UserID, *pt.OrderID, pt.Amount)
```

Wallet-paid create (service returns after cart clear; **no** earn/recs):

```75:79:apps/backend/internal/features/orders/handler.go
	if order.Status == OrderStatusPaid && h.Receipt != nil {
		_ = h.Receipt.SendPaidOrderReceipt(c.Request.Context(), order.UserID, order.ID, order.TotalAmount)
	}
```

Sender always hops a goroutine, then optionally outbox on a **new** connection:

```61:67:apps/backend/internal/features/orders/receipt.go
	async.GoCtx("orders.paid_receipt", 15*time.Second, func(ctx context.Context) {
		if r.notifications != nil {
			_ = r.notifications.DispatchOrderConfirmed(ctx, email, subject, body, order.ID, "")
			return
		}
		_ = r.mailer.Send(ctx, email, subject, body)
	})
```

Crash between `tx.Commit` and enqueue loses the receipt. `NOTIFICATIONS_MODE=inline` never writes outbox.

### 3. Wallet paid ≠ Confirm paid for loyalty/referral

Saga A documents earn after Confirm (`money-and-stock-sagas.md:51–54`). Saga A-wallet documents debit + deduct + receipt only (`:67–86`). Loyalty rule is “earn after **paid**” (`loyalty.md:38–40`).

`settleWalletInTx` does not call `InsertEarnIntent`. `ProcessPendingLoyaltyAwards` is only invoked from `Confirm` (`payments/service.go:426–427`). Grep: **no cron** wires the sweeper despite the comment at `:461–463`. A process crash after Confirm commit leaves `awarded_at IS NULL` forever.

`AwardForOrder` / `OnPaidOrder` are already idempotent (`loyalty/service.go:206–224`, `referral/service.go:83–106`). They are the right **consumers**, not part of the money TX.

### 4. Gift email dual-writes inside Confirm

`FulfillPaidPurchaseTx` issues the card on the caller TX then notifies **before** Confirm commits (`giftcard/service.go:158–164`, `178–213`). Async dispatch inserts `notification_outbox` on the pool. Rollback after issue can still enqueue (or send inline) a code for a card that never committed.

### 5. Analytics treats place-order as purchase

`POST /orders` is classified `order_created` (`middlewares/analytics.go:160–163`). Handler enriches line items on **every** create (`orders/handler.go:48–72`), including pending gateway orders. `stats_job` counts those as purchases/revenue (`corn/stats_job.go:124–135`). Queue can drop (`analytics/queue.go:66`). Deduct/release never emit.

### 6. Reservation TTL releases stock; nobody is told

Cron: `corn/reservation_ttl.go:26–39` → `ExpireStaleReservations`. `expireOne` CAS-fails the order, then **separately** releases stock and fails payments (`orders/expire_reservations.go:159–184`). Not one TX. No dispatcher call. Customer can still pay via `PayOrder` (`orders/service.go:442–484`) after TTL **if** status were still payable — TTL sets `payment_failed`, which is payable; coupon usage is kept (`expire_reservations.go:20–22`). A notice is a consumer; the expire/release must stay a command (and should share one TX).

### 7. Fail webhook and refund are multi-step commands

`Fail` updates only the payment row (`payments/service.go:528–554`). Webhook then `MarkOrderPaymentFailed` then `ReleaseForOrder` (`webhook.go:79–111`) — three connections. **Do not** turn release into an event. Optional later: one TX for fail+release; emit `payment.failed.v1` for notice/analytics only.

`RefundOrder` sequences wallet.Refund TX → restock AdjustStock TXs → clawback → status (`orders/refund.go:59–102`). Wallet/restock stay commands. `ClawbackOrderEarn` is a loyalty **ledger** write — keep fail-closed on the refund command (not an at-least-once consumer). Emit `order.refunded.v1` for receipt/analytics only.

### 8. Coupons

Usage is recorded under the create TX (`orders/service.go:301–305`) after `LockByID` (Saga C). Reverse on cancel TX (`:809–812`). No coupon consumer required for ED-01x.

---

## Proposed event catalog (facts, not commands)

Publish **after** the domain TX commits; the outbox **row** is inserted **in** that TX.

| Type | Idempotency key | Emitted from (same TX as) | Consumers (this lane) | Must not consume |
|------|-----------------|---------------------------|------------------------|------------------|
| `order.placed.v1` | `order:{id}:placed` | CreateOrder (pending or paid) | optional analytics “placed” | reserve, coupon burn |
| `order.paid.v1` | `order:{id}:paid` | Confirm **and** wallet `settleWalletInTx` | receipt, loyalty, referral, paid analytics, recs | deduct, wallet debit |
| `order.payment_failed.v1` | `order:{id}:payment_failed` | Fail+release TX (once unified) or TTL expire TX | TTL/fail notice | release |
| `order.cancelled.v1` | `order:{id}:cancelled` | cancel TX | notice / analytics | release, coupon reverse |
| `order.refunded.v1` | `order:{id}:refunded` | refund command after money/stock/clawback succeed | refund email, analytics | wallet credit, restock, clawback |
| `reservation.expired.v1` | `order:{id}:reservation_expired` | TTL expire TX | customer notice | release |
| `gift.purchased.v1` | `gift_purchase:{txid}` | Confirm TX **after** issue, via TX outbox | existing gift email worker | card insert |

Reuse CloudEvents envelope (`notifications/event.go:29–46`). Do **not** replay wallet ledger from these events.

`payment_loyalty_awards` stays a **consumer cursor** (or is replaced by `notification_deliveries` / a generic consumer ledger). It is not a second public bus.

---

## Ordered lettered backlog (claim top → bottom)

Lane = `ed-money`. Effort: S ≤½ day · M 1–3 days · L multi-day.

### ED-010 — Facts + same-TX emit contract

- [ ] **ED-010a — Money/stock event catalog + anti-goals** · **ed-money** · **P1** · **S**  
  Write the table above into `apps/backend/docs/architecture/money-and-stock-sagas.md` (new “After-commit events” section) + `notifications-kafka.md` topic list. State: events notify; reserve/pay/refund/debit/deduct/release stay SQL.  
  **Files:** `docs/architecture/money-and-stock-sagas.md`, `notifications-kafka.md`, Obsidian `Money and stock rules.md`.  
  **Why:** implementers otherwise turn Confirm into a choreography.

- [ ] **ED-010b — Enqueue on caller `pgx.Tx` (depends ED-000)** · **ed-money** (contract) / **ed-platform** (impl) · **P0** · **M**  
  `OutboxStore` needs `EnqueueTx(ctx, tx, …)`. Dispatcher (or a thin `domain.Publisher`) must accept the open money TX. Do not use `s.db.Exec` for money facts. If ED-000 lands a generic domain outbox, consume it; do not create `money_outbox`.  
  **Files:** `internal/notifications/outbox.go`, `postgres/store.go`, `dispatcher.go` or new `internal/domainevents/`.  
  **Why:** current pool enqueue cannot satisfy “same TX as the domain write” (`store.go:24–29`).

### ED-011 — Emit `order.paid.v1` (still deduct in TX)

- [ ] **ED-011a — Confirm inserts `order.paid.v1` in the money TX** · **ed-money** · **P0** · **M**  
  After `MarkAsPaid` + `DeductForOrderTx` (+ existing `InsertEarnIntent` until ED-013), `EnqueueTx` paid fact. Remove post-commit `sendPaidOrderReceipt` / in-process earn **only after** ED-012/013 consumers exist (feature-flag or dual-run).  
  **Files:** `features/payments/service.go:314–436`, `repository.go:314–322`.  
  **Why:** Confirm is the gateway paid fact; today side effects start only after commit and can vanish.

- [ ] **ED-011b — Wallet checkout emits the same paid fact** · **ed-money** · **P0** · **M**  
  In `settleWalletInTx`, after debit + mark paid + deduct, insert earn intent **and** `order.paid.v1` on **that** TX. Handler receipt (`handler.go:75–79`) goes away once ED-012 runs.  
  **Files:** `features/orders/service.go:323–387`, `handler.go:75–79`.  
  **Why:** wallet is a first-class paid rail (PR-020a) with **zero** loyalty/referral path.

### ED-012 — Receipt consumer

- [ ] **ED-012a — Paid receipt from `order.paid.v1`, not `async.GoCtx`** · **ed-money** · **P0** · **M**  
  Worker: load buyer email, `DispatchOrderConfirmed` **or** send via existing email topic using idempotency `order:{id}:confirm` (`dispatcher.go:74`). Delete goroutine in `receipt.go:61–67`. Inline mode: still enqueue in TX; relay/local consume without Kafka is ED-000.  
  **Files:** `features/orders/receipt.go`, `features/payments/service.go:451–458`, `notifications/dispatcher.go:69–88`.  
  **Why:** PR-020o moved send to “after paid”; it is still not durable.

### ED-013 — Loyalty + referral consumers (not the ledger)

- [ ] **ED-013a — `AwardForOrder` + `OnPaidOrder` consume `order.paid.v1`** · **ed-money** · **P0** · **M**  
  Idempotent keys already exist (`order` / `referral`). Mark `payment_loyalty_awards.awarded_at` (or delivery ledger) only after both succeed. Keep Confirm successful if the consumer is down.  
  **Files:** `features/payments/service.go:425–518`, `features/loyalty/service.go:206–224`, `features/referral/service.go:83–106`.  
  **Why:** earn is defined as after-paid and must not roll back money (`loyalty.md:40–41`).

- [ ] **ED-013b — Pending-earn sweeper (cron)** · **ed-money** · **P1** · **S**  
  Wire `ProcessPendingLoyaltyAwards` (or outbox republish) in `internal/corn` + `bootstrap/container.go`. Today only Confirm calls it; leftovers never retry.  
  **Files:** `payments/service.go:461–468`, `internal/corn/`, `bootstrap/container.go`.  
  **Why:** comment claims a sweeper; none is registered.

### ED-014 — Inventory / revenue analytics (not deduct)

- [ ] **ED-014a — Paid / line-level analytics from `order.paid.v1`** · **ed-money** · **P1** · **M**  
  Stop treating `order_created` on `POST /orders` as purchase/revenue (`stats_job.go:124–135`, `revenue_job.go` filters). Optional: keep `order.placed.v1` for funnel. Consumer writes Timescale (or existing `events` rows) with `order_id`, paid amount, per-line `product_id` / qty.  
  **Files:** `middlewares/analytics.go:160–163`, `orders/handler.go:48–72`, `corn/stats_job.go`, `corn/revenue_job.go`, `internal/analytics/queue.go`.  
  **Why:** pending wallet/gateway creates inflate purchases; deduct has no event.

### ED-015 — Reservation TTL notice (release stays a command)

- [ ] **ED-015a — Expire + release + fail-payment in one TX, then outbox** · **ed-money** · **P1** · **M**  
  Fold `expireOne` (`expire_reservations.go:159–184`) onto one TX: CAS `pending→payment_failed`, `ReleaseForOrderTx`, fail pending payments, `EnqueueTx` `reservation.expired.v1`.  
  **Files:** `orders/expire_reservations.go`, `inventory/service.go:270–278`, `corn/reservation_ttl.go`.  
  **Why:** notice must not fire if release rolls back; today status can flip while stock stays committed.

- [ ] **ED-015b — Customer TTL / pay-again notice** · **ed-money** · **P2** · **S**  
  Consumer of `reservation.expired.v1`: email/SMS “reservation released, pay-again if still wanted” (`PayOrder` at `service.go:442`). Idempotency `order:{id}:reservation_expired`.  
  **Files:** `notifications/dispatcher.go` (new type), `orders/expire_reservations.go`.  
  **Why:** charter consumer list; no notice exists.

### ED-016 — Fail / cancel facts (optional notices)

- [ ] **ED-016a — `order.payment_failed.v1` / `order.cancelled.v1` after command TX** · **ed-money** · **P2** · **M**  
  Emit from webhook-fail path (prefer unifying fail+release first) and `cancelOrder` (`service.go:796–826`). Consumers: analytics, optional email. **Not** a release worker.  
  **Files:** `payments/webhook.go:79–111`, `payments/service.go:528–554`, `orders/service.go:796–826`.

### ED-017 — Refund fact (money stays a command)

- [ ] **ED-017a — `order.refunded.v1` after wallet+restock+clawback+status** · **ed-money** · **P2** · **S**  
  Do **not** choreograph `wallet.Refund` / `AdjustStock` / `ClawbackOrderEarn` via events (`refund.go:59–102`). Optional follow-up (not ED-01x unless claimed): one refund TX — that is still a command rewrite, not ES.  
  **Files:** `orders/refund.go`, `wallet/service.go:323–354`.  
  **Why:** refund email/analytics without a second wallet credit.

### ED-011c — Gift email via TX outbox (adjacent paid side effect)

- [ ] **ED-011c — Move gift notify off the Confirm connection** · **ed-money** · **P1** · **S**  
  After `InsertPurchasedTx`, `EnqueueTx` `gift.purchased.v1` (or existing `notification.gift_purchased.v1`) on the **same** Confirm TX. Remove `notifyPurchased` pool/inline send from inside the TX (`giftcard/service.go:163`, `178–213`). Replay still must not re-send (already skipped at `:141–142`).  
  **Why:** dual-write can email a rolled-back issue.

---

## Claim order (implementation)

1. **ED-010a** (docs)  
2. **ED-010b** (blocked on / pair with **ED-000** TX outbox)  
3. **ED-011a** + **ED-011b** (emit paid)  
4. **ED-012a** (receipt)  
5. **ED-013a** then **ED-013b** (loyalty/referral + sweeper)  
6. **ED-011c** (gift email)  
7. **ED-014a** (paid analytics)  
8. **ED-015a** then **ED-015b** (TTL TX + notice)  
9. **ED-016a** · **ED-017a** (fail/cancel/refund facts)

---

## Explicit non-goals

- Event-sourced wallet / payment / inventory ledgers.  
- Deduct, reserve, release, `PurchaseTx`, coupon lock as Kafka consumers.  
- Replacing `POST /orders` or `/webhooks/payment` with saga orchestration.  
- FE Kafka / WebSocket checkout.  
- Re-doing PR-020 money holes already closed (wallet debit, reservation identity, cancel TX, receipt-on-paid *trigger*). This work makes those after-commit hooks **durable**.  
- Loyalty **clawback** as a best-effort consumer (keep on refund command).  
- Engagement-owned recs/reviews/alerts except as optional `order.paid.v1` subscribers (ED-030).

---

## Suggested verify (when claimed)

- Confirm rollback → no outbox row, no email, no points, no deduct.  
- Confirm commit + kill process → outbox row exists; consumer delivers once.  
- Wallet `INSUFFICIENT_FUNDS` → no paid event, no reserve left.  
- Wallet paid → same consumers as Confirm.  
- Replay webhook / double Confirm → one `order.paid.v1` (unique idempotency), one award (`UNIQUE (reason, ref_type, ref_id)`).  
- Gift Confirm rollback → no gift email.  
- TTL expire rollback → no `reservation.expired.v1`.
