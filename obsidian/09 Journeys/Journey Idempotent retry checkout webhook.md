---
tags: [journey, money, reliability]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Idempotent retry (checkout / webhook)

How Rumera stays safe when the same intent is sent twice.

## A — Place order double-submit

1. Customer on [[Cart and Checkout]] taps **Place order**.
2. FE generates **one** `Idempotency-Key` (UUID) for this intent; keeps it on retry.
3. `POST /orders` with key → **HTTP money middleware** (PH-011c; no auto body-key) + atomic TX.
4. Success → order + [[Inventory]] **reserve** + pending [[Payments]]; response stored under scoped key.
5. Network blip → FE resends **same key + same body** → platform returns **stored 2xx** (no second reserve).
6. Same key, **different body** → **409** conflict (user must start a new intent / new key).
7. Key omitted → request still processes (RequireKey=false) but **no** replay cache — double-submit can double-create.

Related: [[Journey First purchase]] · [[ADR Idempotency platform]]

## B — Payment webhook redelivery

1. Gateway POSTs signed body to `/webhooks/payment` ([[Journey Payment webhook settle]]).
2. Middleware claims key (`Idempotency-Key` or auto body-hash key).
3. First success → Confirm TX: paid + **deduct**; response stored (HTTP layer).
4. Gateway retries identical payload → **HTTP replay** of stored 2xx; handler not run.
5. Domain backup: only **pending** rows transition; **UNIQUE** `transaction_id`
   (`uq_payment_transactions_transaction_id`, PH-011d).
6. If HTTP key expired/missed but payment already terminal → handler still
   **ACK 200** `{replayed:true}` (no second deduct).

## C — Admin wallet credit retry

1. Admin credits customer ([[Wallet Backend]]).
2. Body/header **idempotency key** → ledger marker `idem=<key>` (**service-level truth**).
3. HTTP money middleware also caches 2xx under scoped key (PH-011c).
4. Replay same key → HTTP replay and/or service `replayed: true`; no second deposit.

## D — Gift card redeem retry

1. Customer redeems code ([[Journey Account wallet redeem]]).
2. Natural key: card status one-shot + wallet credit in one TX.
3. HTTP money middleware stops double handler entry when key present; status remains ultimate truth.

## E — Loyalty redeem retry

1. Customer redeems points for wallet credit ([[Loyalty Backend]]).
2. HTTP money middleware (PH-011c) stops double handler entry when key present.
3. Domain spend event key still open (PH-040 patterns) — prefer sending HTTP key today.

## Platform (PH-011b + 011c)

- Store keys are **scoped** by tier + user + route so two customers never share a cache row.
- Stuck in-flight claims older than **~2 minutes** are **reclaimed** automatically.
- Prometheus: `idempotency_*` counters on local `/metrics`.
- **Wired:** webhook, orders, gift redeem, loyalty redeem, admin wallet credit.

## Failure / ops

| Signal | Meaning |
|--------|---------|
| 409 in progress | First attempt still running (or claim &lt; 2m old) — backoff then retry same key |
| 409 body mismatch | Key reused with different payload — new key required |
| Store errors | Fail-open log warn — side effect still subject to DB success |
| Manual clear | Only for dead pending rows; prefer 2m stale reclaim — [[Playbook Debug Idempotency]] |

## Depth

Repo: `apps/backend/docs/architecture/idempotency.md` · `idempotency-runbook.md`

Related: [[Money and stock rules]] · [[Playbook Debug Idempotency]] · [[Playbook Debug Webhook]] · [[Payments]] · [[Orders]]

#journey #money
