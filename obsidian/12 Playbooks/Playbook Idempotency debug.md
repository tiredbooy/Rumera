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
2. Query `idempotency_keys` for scoped key `cust:{uid}:POST:…`
3. In-flight (`response_code=0`) older than **2m** → reclaim on next claim
4. Webhook: HMAC + UNIQUE `transaction_id` + terminal **200 replayed**
5. Metrics: `idempotency_missing_key_total`, `idempotency_conflict_total`

## Related

[[Money and stock rules]] · [[Payments Backend]] · [[Wallet Backend]] ·  
[[Orders Backend]] · [[Playbook Debug Webhook]] · [[Playbook Debug Oversell]] ·  
[[ADR Idempotency platform]] · [[Journey Idempotent retry checkout webhook]]

#playbook #money
