---
tags: [decision, money, reliability]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Idempotency platform

**Status:** accepted · **PH-011 complete** (011a–e)  
**Date:** 2026-08-11  
**Program:** PH-011a–e (design, platform, mounts, UNIQUE gateway tx id, runbook)

## Context

Clients and payment gateways deliver **at-least-once**. Middleware + table
`idempotency_keys` are production-scoped (011b) and mounted on P0 money routes
(011c). Admin wallet credit keeps a **service-level** ledger key **and** HTTP
platform. Loyalty redeem requires a client key; domain spend `ref_id` is
`{userID}:idem:{key}` (PR-003g).

## Decision

1. **Header:** `Idempotency-Key` (8–128 chars, no whitespace/`|`).
2. **Scoped store key:** `{tier}:{principal}:{METHOD}:{routeTemplate}:{clientKey}`  
   — implemented in middleware (not raw global client key as PK).
3. **Fingerprint:** SHA-256 of raw body; same key + different body → **409**.
4. **Cache only 2xx;** non-2xx **Release** claim for retry.
5. **In-flight** (`response_code=0`) → 409; **stale reclaim** after **2 minutes**.
6. **Fail-open** only on store I/O errors; never on logical conflicts.
7. **Layered truth:** HTTP replay + domain natural keys (payment pending→paid,
   gift-card status, admin credit `idem=`, loyalty order award).
8. **Unique** `payment_transactions.transaction_id`
   (`uq_payment_transactions_transaction_id`, CONCURRENTLY; PH-011d).
9. **Retention** 30d default via existing cleanup cron.
10. **Metrics:** `idempotency_claim_total`, `replay`, `conflict`, `complete_error`, `missing_key`.
11. **P0 routes (011c wired):** webhook (auto-key), `POST /orders`, admin wallet
    credit (HTTP + service), gift-card redeem, loyalty redeem. Future:
    top-up/purchase (PH-041/042). Money policy: `AllowAutoKey=false`,
    `RequireKey=false` until FE always sends keys.
12. **Webhook terminal ACK:** already-settled Confirm/Fail → HTTP **200**
    `{received, replayed:true}` so gateways stop (pending-only domain).

## Consequences

- FE/BFF must generate and forward `Idempotency-Key` on checkout and money actions
  for replay safety (without a key, request still processes — no platform cache).
- CORS `Allow-Headers` includes `Idempotency-Key` so browser-direct Go calls from
  an allowed origin pass preflight ([[BFF Proxies]]).
- Gateway settlement is three-layered: HTTP key + UNIQUE tx id + pending-only.
- Operator runbook + per-route API docs + vault playbook shipped (**PH-011e**).

## Depth (project)

Repo: `apps/backend/docs/architecture/idempotency.md` ·  
`apps/backend/docs/architecture/idempotency-runbook.md` ·  
API: `orders.md`, `wallet.md`, `gift-cards.md`, `loyalty.md`, `webhooks.md`

## Related

[[Money and stock rules]] · [[Payments Backend]] · [[Wallet Backend]] · [[Orders]] ·  
[[Gift Card Backend]] · [[Loyalty Backend]] ·  
[[Journey Idempotent retry checkout webhook]] · [[Journey Payment webhook settle]] ·  
[[Journey First purchase]] · [[Playbook Debug Idempotency]] · [[Pitfalls and anti-patterns]] ·  
[[ADR Order reserve and pay deduct atomic]]

#decision #money
