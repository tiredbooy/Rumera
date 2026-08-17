---
tags: [journey, account]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Gift card purchase

**Status:** API PH-042a · **storefront PH-042b done**

## Flow

1. Customer opens `/account/wallet` → **خرید کارت هدیه**
2. Chooses amount (presets / custom, same bounds as top-up)
3. `POST /gift-cards/purchase` + `Idempotency-Key` (store [[BFF Proxies]] forwards the header) → pending `gbuy-…` + `payment_url`
4. Storefront shows «پرداخت در درگاه» when `payment_url` is non-empty (same window; PR-030c · [[Account FE]] · [[Journey Account wallet top-up]]). Empty URL (dev, env unset) keeps pending copy only — not paid; FE does not invent a start URL.
5. Webhook Confirm → `FulfillPaidPurchaseTx` issues active code
6. **Email (PR-005b):** purchaser receives Persian mail with **code** + amount after a *new* issue. Replay does not re-send. Send failure does not roll back — code stays on mine. Unset mailer/dispatcher skips email (fulfill still succeeds). See [[Notifications]] · [[Playbook Debug Webhook]]
7. **بروزرسانی کارت‌ها** → `GET /gift-cards/mine` shows code + face amount
8. Self-redeem via «استفاده از کارت» **or** copy code for gift recipient → [[Journey Account wallet redeem]]

## Delivery

- **Email:** after paid fulfill (new issue only). Dispatcher outbox preferred; `notify.Mailer` fallback.
- **Self:** mine list is the fallback if email was skipped or failed
- Face amount on mine list = single-use “balance”; no partial redeem

## Non-goals

- Free codes, multi-currency, staff issue from storefront

Related: [[Gift Card Backend]] · [[Payments Backend]] · [[Loyalty Wallet Gift Cards]] · [[Account FE]]

#journey
