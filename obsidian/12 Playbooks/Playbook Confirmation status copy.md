---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Confirmation status copy

## Symptoms / when to use

`/checkout/confirmation/:id` says «سفارش تأیید شد» or «سپاس از خرید شما» while the order is still `pending` or `payment_failed`. Shopper thinks money was taken.

`payment_method: wallet` on a **pending** or **failed** order must not read as if the wallet was already charged. After PR-020a, a successful wallet checkout is `paid` and only then may say the wallet was debited.

## Steps

1. Read server order status **and** `payment_method` — this page does not complete payment ([[Cart and Checkout]] · [[Payments]] · [[Loyalty Wallet Gift Cards]])
2. Pending hero must be «سفارش ثبت شد» + «در انتظار پرداخت» ([[Journey First purchase]])
3. Failed payment uses «پرداخت ناموفق»; never celebration copy
4. Wallet + `pending`: waiting / unpaid / موجودی ناکافی — never paid, charged, «تسویه», «برداشت شد»
5. Wallet + `payment_failed`: failed, not charged (or charge rolled back)
6. Wallet + paid-like (`paid` / processing / shipped / delivered): may say the wallet was charged
7. Badge stays `ORDER_STATUS_FA`
8. Loyalty stay paid-gated ([[Loyalty FE]]); non-wallet settle is webhook ([[Playbook Debug Webhook]])

## Verify

- Pending markup does not contain «سفارش تأیید شد»
- Wallet + pending markup does not contain paid / charged / «تسویه» / «برداشت شد»
- From `apps/frontend`: `npx vitest run features/orders/components/order-confirmation-view --passWithNoTests`

## Related

[[Cart and Checkout]] · [[Journey First purchase]] · [[Orders]] · [[Playbooks MOC]]

#playbook
