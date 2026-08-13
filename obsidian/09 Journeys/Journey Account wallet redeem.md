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
   - Domain: card status one-shot (no double burn)
3. Optionally redeem loyalty points the same way (HTTP key recommended)
4. Optionally pay with wallet at checkout ([[Payments]])

Related: [[Loyalty Wallet Gift Cards]] · [[Gift Card Backend]] · [[Wallet Backend]] ·  
[[Account Domain]] · [[Surface Account]] · [[Playbook Debug Idempotency]]

#journey
