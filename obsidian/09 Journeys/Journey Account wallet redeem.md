---
tags: [journey, account]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Account wallet redeem

1. Login → [[Account FE]] → wallet
2. Redeem gift card code → credits wallet (single-use full face amount; Idempotency-Key)  
   Codes may come from gift purchase mine list or staff-issued cards  
   - Prefer `Idempotency-Key` once per redeem intent ([[Journey Idempotent retry checkout webhook]])
   - Store [[BFF Proxies]] forwards that header unchanged; it does not invent one
   - Domain: card status one-shot (no double burn)
3. Optionally redeem loyalty points the same way (`Idempotency-Key` **required**; missing → `400`. Ledger `{userID}:idem:{key}`). Wallet Toman/point on `/account/rewards` comes from `GET /loyalty` `redeem_value` ([[Loyalty FE]], PR-003l) — not a hardcoded 1000.
4. Optionally pay with wallet at checkout ([[Payments]])

Related: [[Loyalty Wallet Gift Cards]] · [[Gift Card Backend]] · [[Wallet Backend]] ·  
[[Account Domain]] · [[Surface Account]] · [[Playbook Debug Idempotency]]

#journey
