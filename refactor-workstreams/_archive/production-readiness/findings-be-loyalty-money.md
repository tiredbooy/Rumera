# Findings — `be-loyalty-money`

**Agent:** be-loyalty-money  
**Workstream:** `production-readiness-20260816`  
**Date:** 2026-08-16  
**Mode:** investigation only (no application code)

PR-003a (loyalty BE completeness, admin first). Adjacent money only when the gap is live in code. Do **not** reopen PH-040 / PH-041 / PH-042 / PH-043c unless a **new** live bug is shown.

---

## What I inspected

| Area | Paths |
|------|--------|
| Loyalty slice | `/home/tehranspeaker/Videos/Rumera/apps/backend/internal/features/loyalty/` (`routes.go`, `handler.go`, `service.go`, `repository.go`, `model.go`, `wire.go`, tests) |
| Docs | `apps/backend/docs/api/loyalty.md`, `docs/architecture/loyalty.md`, `docs/architecture/idempotency.md` §5, wallet-topup / gift-card-purchase / box-subscriptions |
| Earn wiring | `payments/service.go` Confirm, `auth` signup + OTP, `reviews/service.go` Create, `referral/service.go` OnPaidOrder, `internal/corn/loyalty_birthday_job.go`, `internal/bootstrap/container.go` |
| Schema | `apps/backend/migrations/main/20260615160000_create_loyalty.sql` |
| Admin/customer FE | `apps/frontend/features/admin/loyalty/*`, `app/admin/loyalty/page.tsx`, `features/loyalty/*`, `lib/rbac/nav.ts` |
| BFF | `apps/frontend/app/api/store/[...path]/route.ts`, `app/api/admin/[...path]/route.ts` |
| Adjacent money | `wallet/` (top-up), `giftcard/` (purchase + fulfill), `subscription/` PATCH, `orders.UpdateOrderStatus`, `rbac/model.go` |
| Closed work | PH-040a–e, PH-011, PH-041a, PH-042a, PH-043a–c — not re-done |

---

## Current loyalty surface vs a complete e-commerce service

### What PH-040 actually shipped (still true)

Customer programme engine is real:

- Env-only rates (`LOYALTY_*`) loaded in `loyalty.New` → `Programme()` snapshot, `editable: false`.
- Earn triggers: paid order, signup, referral both-sides, verified review, birthday cron.
- Redeem → wallet; compensating `redeem_reversal` if deposit fails.
- `ClawbackOrderEarn` helper + unit tests; **not** wired to refunds.
- Prometheus `loyalty_award_total` / `loyalty_redeem_total`.
- Ledger `UNIQUE (reason, ref_type, ref_id)` — **this uniqueness exists**. It is not missing on the table.

### Mounted HTTP (complete list)

```14:30:apps/backend/internal/features/loyalty/routes.go
	c.GET("/loyalty", h.GetAccount)
	c.GET("/loyalty/transactions", h.ListTransactions)
	// POST /loyalty/redeem + moneyIdem
	admin.GET("/loyalty/programme", h.GetProgramme)
```

Composer: customer + moneyIdem at `apps/backend/internal/routes/routes.go:144`; admin `customers:read|write` at `:186`.

No other loyalty routes exist. There is **no** `loyalty:write` in `rbac/model.go` (lines 7–38).

### Jobs / side effects

| Trigger | Where | Status |
|---------|--------|--------|
| Order paid | `payments.Service.Confirm` after TX commit (`service.go:308–312`) | Live, **best-effort, not retried** |
| Referral | `referral.OnPaidOrder` after `Complete` (`service.go:72–92`) | Live, Complete then Award **not one TX** |
| Signup | `auth/handler.go:130`, `auth/otp.go:170` | Live, errors ignored |
| Review | `reviews.Service.Create` after insert (`service.go:64–67`) | Live, verified-only |
| Birthday | cron `loyalty_birthday` → `RunBirthdayAwards` | Live |
| Admin adjust | designed `architecture/loyalty.md` §4.6 | **Not implemented** |
| Order refund clawback | `ClawbackOrderEarn` | Helper only |

### vs a real shop loyalty admin (Yotpo / LoyaltyLion / Shopify — not Netflix)

Staff today can only **read env rates**. They cannot:

| Operator job | Today |
|--------------|--------|
| Change earn/redeem rates or tiers without restart | No (env + hardcoded SQL tiers) |
| Disable the programme | No `enabled` flag |
| Search members by email / tier / balance | No admin list |
| Open a member account + ledger | No; customer ledger hides `id`/`ref_*` |
| Manual grant / clawback with note + audit | Reason `admin_adjust` exists in the enum only |
| See programme health (awards, redemptions) in admin | Prometheus only |
| Freeze a fraudulent account | No |
| Change ship-to / expire points / tier multipliers | Explicit non-goals (OK) |

Customer storefront (account/rewards) is **functionally complete** against live BE: balance, 50-row history, redeem with client key. Gaps are operator + money-safety, not “missing Netflix entitlements”.

---

## Missing admin / customer APIs (with file:line)

### Admin — not mounted

| Need | Evidence |
|------|----------|
| Member search | No handler. `RegisterAdmin` is only `GET /loyalty/programme` (`routes.go:23–30`). |
| Member account | `GetAccount` is JWT-self only (`handler.go:22–33`). |
| Admin ledger | `ListTransactions` strips `id`, `ref_type`, `ref_id` (`service.go:320–329`, `model.go:74–78`). Limit 50, no page. |
| Manual adjust | `LoyaltyReasonAdminAdjust` (`model.go:40`) never written. Architecture planned `POST /admin/users/:id/loyalty/adjust` (`architecture/loyalty.md:160–171`). API doc: “Admin adjust remains designed … not mounted” (`api/loyalty.md:24`). |
| Persist rates / tiers | `ProgrammeResponse.Editable` always false (`service.go:91–110`). Award upsert **hardcodes** 1000/5000/20000 in SQL (`repository.go:83–98`) independently of `TierFor` / env. |
| Disable programme | No column, no env kill-switch besides setting bonuses to 0 (order earn still runs if divisor > 0). |
| Audit | Ledger has no `note`, `actor`, `meta`. Wallet admin credit encodes `actor=` + `idem=` in description (`wallet/service.go:85`) — loyalty has no analogue. |

### Customer — thin vs ops

- `GET /loyalty/transactions`: no pagination, no refs (`handler.go:35–46`).
- Redeem without `Idempotency-Key` uses `{userID}-{nanos}` (`service.go:312–318`) — not client-stable.

### FE is **not** calling missing endpoints

| FE | Calls |
|----|--------|
| `features/admin/loyalty/api/server.ts:7–8` | `GET /admin/loyalty/programme` only |
| `app/admin/loyalty/page.tsx` | same, `customers:read` |
| `LoyaltyProgrammeView` | read-only cards + link to `/admin/customers` |
| `features/loyalty/api.ts` | `GET /loyalty`, `GET /loyalty/transactions`, `POST /loyalty/redeem` |

So “FE calling endpoints that do not exist” is **false today**. Completing admin (founder PR-003) requires **new BE** then FE (PR-003b).

Admin programme GET uses server `apiFetch` → Go directly (`lib/api/client.ts` + `API_BASE`). That path works. Customer money mutations go through `/api/store/*` (see live bug below).

---

## Production risks (evidence)

### P0 — BFF drops `Idempotency-Key` (new live bug, not a redo of PH-011)

PH-011 + PH-040b contract: BFF **must** forward `Idempotency-Key` (`architecture/idempotency.md:331–332`). Domain redeem binds `ref_id = "idem:"+key` (`loyalty/handler.go:66–68`, `service.go:312–316`).

Store BFF forwards **only** `Authorization` and `Content-Type`:

```64:73:apps/frontend/app/api/store/[...path]/route.ts
	headers: {
		...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
		...(body ? { "Content-Type": "application/json" } : {}),
	},
```

Same omission on admin BFF (`app/api/admin/[...path]/route.ts:92–109`). Admin wallet credit still works because the **body** carries `idempotency_key` (`wallet-credit-form.tsx:91–95`). Loyalty/wallet/gift storefront only send the **header**.

Effect: Go money middleware never sees the key; `Redeem` falls back to nano `ref_id`; a double-click or retry **double-spends** points and double-credits the wallet. Same for `POST /wallet/topup` and gift purchase/redeem.

### P1 — Earn after Confirm is fire-and-forget

```308:315:apps/backend/internal/features/payments/service.go
	if pt.OrderID != nil {
		if s.loyalty != nil && pt.UserID != nil {
			_ = s.loyalty.AwardForOrder(...)
		}
		if s.referral != nil && pt.UserID != nil {
			_ = s.referral.OnPaidOrder(...)
		}
	}
```

`Confirm` is pending-only. A failed `AwardForOrder` after a successful commit is **never retried**. Documented as best-effort; still a production miss for “paid but no points”. Same pattern on review/signup (`_ =`).

### P1 — Referral complete then award (lost points)

`referral.OnPaidOrder` (`service.go:83–91`): `Complete` first, then two `_ = loyalty.Award`. If award fails, the pending row is gone; next paid order finds nothing.

### P1 — Unique key is **global**, spend key is not user-scoped

Migration (`20260615160000_create_loyalty.sql:23`): `UNIQUE (reason, ref_type, ref_id)` — **not** per `user_id`. Architecture is explicit (`loyalty.md:92–96`).

`Spend` uses `ref_id = "idem:"+clientKey` with **no user prefix** (`service.go:312–316`). HTTP idempotency **is** user-scoped (`pkg/middleware/idempotency.go:75–79`). Two users with the same header (or a crafted key) → second spend is a silent replay (`repository.go:126–130`). Fix: `ref_id = "{userID}:idem:{key}"`.

Uniqueness on **award** is present and correct for order/review/signup/birthday keys. The job prompt’s “missing uniqueness” is this spend/admin-adjust scoping hole, **not** a missing ledger unique.

### P1 — Award vs spend race is mostly OK; remaining hole is no account lock on Award

`Award` inserts ledger then upserts balance in one TX (`repository.go:61–106`). Concurrent different keys serialize on the account row via `ON CONFLICT DO UPDATE`. `Spend` claims ledger then `UPDATE … WHERE points_balance >= $2` (`repository.go:109–149`). That is sound.

`Award` does **not** `FOR UPDATE` the account (Clawback does, `repository.go:163–166`). Not a double-grant given the unique key. Residual: `tier_since` is never updated on promotion (`repository.go:90–98`).

### P1 — Clawback not wired

`orders.UpdateOrderStatus` (`orders/service.go:509–515`) only writes status. `ClawbackOrderEarn` has zero callers outside tests. Policy in `architecture/loyalty.md` §6: wire with refund saga; full clawback on **full** refund only. Do not invent a refund product — hook when status becomes `refunded`.

### P2 — Redeem reversal swallows Award errors

`service.go:300–305`: if wallet `Deposit` fails, `_, _ = repo.Award(… redeem_reversal …)`. Points can vanish.

---

## Adjacent money (real code gaps only)

**Not reopening PH-043c** (email-only renewal, no tokenized auto-charge).

### Wallet / gift — no payment redirect (real)

`CreateWalletTopUp` / `CreateGiftCardPurchase` insert a pending `payment_transactions` row and return `{payment_id, transaction_id, amount, currency, status}` (`payments/service.go:119–169`, `wallet/handler.go:91–97`). There is **no** `payment_url` / gateway session. Customer routes for payments are a no-op (`payments/routes.go:18–19`).

FE `wallet-topup.tsx` / `gift-card-purchase.tsx` show “pay at the gateway with this id” and a copy button. PH-041a listed “Gateway SDK embed” as a non-goal — still a **production** hole: nobody can actually pay. Same platform gap as checkout (no customer payment-start URL). Propose a **new** payment-start task, do not rewrite PH-041/042.

Admin BFF also drops `Idempotency-Key` (body key saves wallet credit only).

### Gift email (real, documented residual)

`giftcard` package has **zero** notify/email calls. `FulfillPaidPurchaseTx` only inserts the code (`service.go:69–112`). Architecture non-goal (`gift-card-purchase.md:48`): “Email delivery (FE/notify later)”. Buyer must poll `GET /gift-cards/mine`. No recipient email on purchase body either.

### Subscription address PATCH (real)

`UpdateSubscriptionReq` is `{action}` only (`subscription/model.go:44–47`). `Service.Update` only pause/resume/cancel/skip (`service.go:48–92`). Repository has **no** `SetAddress`. Documented residual (`box-subscriptions.md:139`). FE `UpdateSubscriptionInput` is action-only (`features/subscriptions/types.ts:23–25`); address is create-time only. An active box cannot change ship-to without cancel+recreate.

---

## Cross-notes

### `fe-cart-loyalty`

- Admin UI today = read-only programme. Completing PR-003b needs the contract in `BOARD.md` mid-post.
- Storefront redeem/top-up/gift **must** keep sending `Idempotency-Key`; BFF must start forwarding it.
- Do **not** invent earn amounts in the client (`DEFAULT_REVIEW_BONUS_POINTS` is copy-only).
- Order confirmation: points only after **paid** (`AwardForOrder` post-Confirm). Current FE docs already say this (`docs/features/loyalty.md:29`).

### Cart / orders

- Earn uses **settled payment amount**, not cart subtotal (`AwardForOrder` ← `pt.Amount`).
- Guests without `user_id` earn nothing.
- Status `refunded` does not claw back points. When refunds land, call `ClawbackOrderEarn(userID, orderID)` — do not decrease lifetime.

---

## Proposed lettered tasks

IDs extend PR-003 (loyalty) and add PR-005 (adjacent money). Coordinator merges into `TASKS.md`.

| ID | Title | Lane | Sev | Size | Why | Files |
|----|--------|------|-----|------|-----|--------|
| **PR-003c** | Store/admin BFF must forward `Idempotency-Key` | both | **P0** | S | Live double-spend on redeem / top-up / gift. PH-011 required this; BFF never did. | `apps/frontend/app/api/store/[...path]/route.ts`, `app/api/admin/[...path]/route.ts` |
| **PR-003d** | Admin member search + account + paginated ledger | be | P1 | M | Staff cannot operate Cellar Club. | `loyalty/routes.go`, `handler.go`, `service.go`, `repository.go`, `docs/api/loyalty.md` |
| **PR-003e** | Admin adjust (grant/clawback) + actor/note/idempotency | be | P1 | M | Designed PH-040d, not mounted. Use UUID `:userID` like wallet credit. | `loyalty/*`, `routes.go`, RBAC (`customers:write` or new `loyalty:write`) |
| **PR-003f** | Persist programme rates/tiers + `enabled` (not site_settings) | be | P1 | L | Env-only; SQL tiers hardcoded; cannot disable. | new migration, `loyalty/service.go`, `repository.go` Award CASE |
| **PR-003g** | Scope spend `ref_id` to `userID` (and require key on redeem) | be | P1 | S | Global unique + unscoped `idem:` key. | `loyalty/service.go` `redeemRefID`, `repository.go` Spend |
| **PR-003h** | Earn reliability: Confirm/referral outbox or retry | be | P1 | M | Paid-without-points; referral Complete orphans awards. | `payments/service.go`, `referral/service.go`, optional outbox |
| **PR-003i** | Call `ClawbackOrderEarn` on full `refunded` status | be | P1 | S | Helper ready; `UpdateOrderStatus` is status-only. Do not build full refund saga here. | `orders/service.go`, `loyalty.ClawbackOrderEarn` |
| **PR-003j** | Customer ledger: pagination + `id`/`ref_type`/`ref_id` | be | P2 | S | Ops + FE history; unbounded 50 today. | `loyalty/model.go`, `service.go`, `api/loyalty.md` |
| **PR-005a** | Payment-start URL on wallet top-up + gift purchase (and checkout) | be | P1 | M | Intents have no `payment_url`; customer cannot pay. New work, not a PH-041/042 rewrite. | `payments/service.go`, `wallet`/`giftcard` handlers + API docs |
| **PR-005b** | Email gift code after paid fulfill | be | P2 | M | No notify in `giftcard`. | `giftcard/service.go`, notification outbox |
| **PR-005c** | `PATCH /subscriptions/:id` accept `address_id` | be | P1 | S | Documented residual; FE cannot change ship-to. Not PH-043c. | `subscription/model.go`, `service.go`, `repository.go`, `docs/api/subscriptions.md` |

**Suggested implement order:** PR-003c → PR-003e + PR-003d (admin usable) → PR-003g → PR-003h → PR-003i → PR-003f → PR-003j. Money: PR-005a then PR-005c, PR-005b last.

**Do not redo:** PH-040 env programme snapshot, earn catalogue, birthday job, redeem compensating award, PH-041a pending top-up row, PH-042a gbuy fulfill, PH-043c no auto-charge.

---

## Contract snapshot for FE admin (v1)

If `fe-cart-loyalty` agrees, implement BE as:

- Keep `GET /admin/loyalty/programme` (`{data: ProgrammeResponse}`). Add `enabled` when PR-003f lands.
- New lists use **`{results, pagination}`** (admin users style).
- Member `:userID` = **UUID** (same as `POST /admin/users/:userID/wallet/credit`).
- Adjust: `POST /admin/users/:userID/loyalty/adjust` with `delta`, `note`, `idempotency_key` + header. Positive → Award `admin_adjust`; negative → Clawback (do not reduce lifetime).
- Do not add Netflix-style entitlements, checkout tier discounts, or public grant.

Full field table is in `BOARD.md` mid-post.
