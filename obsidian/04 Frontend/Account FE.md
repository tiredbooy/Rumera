---
tags:
  - frontend
  - account
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Account FE

`/account/*` — `requireUser`, force-dynamic, noindex, [[Account FE|AccountShell]].

Nav: orders, addresses, wishlist, taste, rewards, subscriptions, wallet, reviews, settings.

Hooks call [[BFF Proxies]] store APIs for [[Loyalty Wallet Gift Cards]], etc.

## Loyalty UX (PH-040c)

- `/account/rewards` — balance, how-to-earn, ledger reasons FA, redeem + Idempotency-Key
- Review submit toast when `verified_purchase` — earn transparency
- Order confirmation — points only after paid; link to rewards
- Details: [[Loyalty FE]] · `apps/frontend/docs/features/loyalty.md`

## Wallet UX (PH-041b)

- `/account/wallet` — gateway top-up form + gift redeem; no free deposit
- Pending top-up shows `transaction_id`; refresh after payment
- Docs: `apps/frontend/docs/features/wallet.md` · [[Journey Account wallet top-up]]

Related: [[Account Domain]] · [[Auth and Sessions]] · [[Payments]] · [[Loyalty Backend]] · [[Wallet Backend]]

Bridge: `apps/frontend/docs/features/account-surface.md`

#frontend #account
