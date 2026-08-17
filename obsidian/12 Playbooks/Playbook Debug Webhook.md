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
8. Paid order must have `paid_at` set (`MarkAsPaid` COALESCE stamp, PR-020h). Null `paid_at` on `status=paid` is pre-fix / admin-path drift — [[Orders]] · [[Money and stock rules]]
9. Customer never reached the gateway: storefront top-up / gift pending shows «پرداخت در درگاه» **only** when the intent includes a non-empty `payment_url` (PR-030c · [[Journey Account wallet top-up]] · [[Journey Gift card purchase]]). Empty URL (dev, `PAYMENT_START_BASE_URL` unset) is not paid — do not invent a start URL. Order create still has no field (PR-020f).
10. **Gift buy (`gbuy-*`):** Confirm calls `FulfillPaidPurchaseTx`. Code is on `GET /gift-cards/mine` even if email failed. Replay of the same `purchase_txid` must **not** re-send mail (PR-005b). Logs: `giftcard: skip purchase email` (`mailer_unset` / `email_lookup_unset` / `no_email`) or `purchase email dispatch/send failed`. Never expect the full code in info logs. Unset mailer until PR-020a wires `WithMailer`/`WithDispatcher` — [[Loyalty Wallet Gift Cards]] · [[Notifications]]

Related: [[Journey Payment webhook settle]] · [[Journey Idempotent retry checkout webhook]] ·  
[[Payments]] · [[Env and config]] · [[Playbook Debug Idempotency]]
