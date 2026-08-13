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
3. `POST /gift-cards/purchase` + `Idempotency-Key` → pending `gbuy-…`
4. Pays gateway with that transaction id (no embedded redirect URL yet)
5. Webhook Confirm → `FulfillPaidPurchaseTx` issues active code
6. **بروزرسانی کارت‌ها** → `GET /gift-cards/mine` shows code + face amount
7. Self-redeem via «استفاده از کارت» **or** copy code for gift recipient → [[Journey Account wallet redeem]]

## Delivery

- **Self:** mine list only (no email delivery API in v1)
- Face amount on mine list = single-use “balance”; no partial redeem

## Non-goals

- Free codes, multi-currency, staff issue from storefront

Related: [[Gift Card Backend]] · [[Payments Backend]] · [[Loyalty Wallet Gift Cards]] · [[Account FE]]

#journey
