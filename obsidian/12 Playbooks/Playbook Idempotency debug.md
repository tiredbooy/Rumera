---
tags: [playbook, money, ops]
aliases:
  - Debug idempotency
  - Idempotency runbook
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook Idempotency debug

Canonical depth: repo  
`apps/backend/docs/architecture/idempotency-runbook.md` ·  
`apps/backend/docs/architecture/idempotency.md`

## Quick checks

1. Did the client send `Idempotency-Key`? (orders / redeem / admin credit)
2. Did store/admin BFF **forward** it? (`pickIdempotencyKeyHeader` — no invented key)
3. Browser-direct Go call: did CORS preflight allow `Idempotency-Key`? ([[BFF Proxies]] · [[ADR Idempotency platform]])
4. Query `idempotency_keys` for scoped key `cust:{uid}:POST:…`
5. In-flight (`response_code=0`) older than **2m** → reclaim on next claim
6. Webhook: HMAC + UNIQUE `transaction_id` + terminal **200 replayed**
7. Metrics: `idempotency_missing_key_total`, `idempotency_conflict_total`

## Related

[[Money and stock rules]] · [[Payments Backend]] · [[Wallet Backend]] ·  
[[Orders Backend]] · [[Playbook Debug Webhook]] · [[Playbook Debug Oversell]] ·  
[[ADR Idempotency platform]] · [[Journey Idempotent retry checkout webhook]]

#playbook #money
