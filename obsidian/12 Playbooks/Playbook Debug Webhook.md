---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug webhook

## Symptoms

Gateway paid but order pending · 401/503 on webhook · stock not deducted.

## Checks

1. `CRYPTO_WEBHOOK_KEY` set (503 if empty)
2. Signature over **raw body** hex HMAC-SHA256
3. `transaction_id` matches pending row
4. Status exactly `succeeded` / `failed`
5. Logs around `PaymentWebhook` / Confirm errors
6. Idempotent redelivery: already settled → **200** `{replayed:true}` (not a hard error)
7. HTTP auto-key + UNIQUE `transaction_id` — [[Playbook Debug Idempotency]]

Related: [[Journey Payment webhook settle]] · [[Journey Idempotent retry checkout webhook]] ·  
[[Payments]] · [[Env and config]] · [[Playbook Debug Idempotency]]
