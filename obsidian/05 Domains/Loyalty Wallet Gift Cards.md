---
tags: [domain, account]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Loyalty · Wallet · Gift Cards

## Loyalty

- Account points balance + append-only ledger (unique reason/ref for idempotent earn)
- **Customer ledger (PR-003j):** `GET /loyalty/transactions` is paginated `{results, pagination}` and includes `id` / `ref_type` / `ref_id` (same row fields as the admin ledger). See [[Loyalty Backend]] · [[Loyalty FE]].
- **Earn (live):** paid order, signup, referral, verified review, birthday (cron), admin adjust (PR-003e)  
- **Admin reads (PR-003d):** member search, member account, paginated ledger (`customers:read`, UUID `user_id`)
- **Admin write (PR-003e):** `POST /admin/users/:userID/loyalty/adjust` (`customers:write`, UUID, idempotent grant/clawback; clawback does not reduce lifetime)
- **Admin programme poster (PR-003k):** `/admin/loyalty` catches programme fetch failure and shows retry; 403 stays [[RBAC]] `requirePermission`
- **Admin operator UI (PR-003b):** member search + detail + ledger + adjust form on `/admin/loyalty` · `/admin/loyalty/[userID]`. Adjust hidden without `customers:write`.
- **Admin programme persist (PR-003f):** `PUT /admin/loyalty/programme` (`customers:write`) writes rates/tiers/`enabled` to dedicated loyalty tables (not `site_settings`). GET includes `enabled`; `config_source` is `db`. Kill-switch skips earn and rejects redeem/adjust (`LOYALTY_DISABLED`).

- **Redeem** via customer API → wallet credit. Key required (`Idempotency-Key` or body). Ledger `ref_id` is `{userID}:idem:{key}` (PR-003g) so two users cannot collide. `GET /loyalty` includes `redeem_value` so [[Loyalty FE]] previews the live Toman/point (PR-003l; not a hardcoded 1000).  
- **Clawback (PR-003i):** admin `PATCH` order status to full `refunded` calls `ClawbackOrderEarn` — **balance only**, not lifetime. Not called for `partially_refunded`. Wallet/restock refund is still [[Journey Admin refund restock]] / PR-020d.
- Config: DB `loyalty_programme` (env `LOYALTY_*` is seed) → [[Env and config]] · [[Loyalty Backend]]
- Full rules: project `architecture/loyalty.md` · [[Loyalty Backend]]

## Wallet

- One wallet per user (get-or-create)
- **No free deposit**; withdraw → **410 Gone**
- Credits: admin (idempotent), gift redeem, loyalty redeem, refunds, **gateway top-up** (PH-041a API)
- Checkout `payment_method=wallet` **debits** on `POST /orders` (PR-020a · [[Orders]] · [[Money and stock rules]])
- Top-up journey: [[Journey Account wallet top-up]] — intent includes `payment_url` (PR-005a; [[Payments Backend]]); [[Account FE]] shows «پرداخت در درگاه» only when the URL is non-empty (PR-030c)

## Gift cards

- Admin issue/batch create (integration-tested atomicity)
- Admin **list + void** (PR-056a BE · PR-064a FE): `GET /admin/gift-cards` `{results, pagination}`; `POST /admin/gift-cards/:id/void` (active → `disabled`; not a refund). Capability stays `gift-cards:issue`.
- Customer **purchase** (PH-042a/b): `POST /gift-cards/purchase` → `gbuy-…` + `payment_url` (PR-005a) → FE pay CTA when URL present (PR-030c) → fulfill on Confirm → email code (PR-005b, new issue only) + `GET /gift-cards/mine`
- Customer redeem → wallet credit (HTTP idempotency + status natural key)
- FE: purchase + mine + redeem on `/account/wallet` · admin issue + ledger on `/admin/gift-cards`
- Journey: [[Journey Gift card purchase]]

## Money retries

Money POSTs should send `Idempotency-Key` — [[Playbook Debug Idempotency]] · [[ADR Idempotency platform]]

Store and admin [[BFF Proxies]] forward that header when present
(`pickIdempotencyKeyHeader`). They never invent a key. Loyalty redeem, wallet
top-up, gift purchase/redeem, and admin wallet credit all depend on this.

## Code map

| Area | Path |
|------|------|
| Loyalty FE | `features/loyalty/` · [[Loyalty FE]] (PH-040c UX) |
| Wallet FE | `features/wallet/` · account wallet view |
| Gift cards FE | `features/gift-cards/` · admin |
| BE | loyalty / wallet / giftcard features |

## Related

[[Account Domain]] · [[Account FE]] · [[Referrals]] · [[Payments]] ·  
[[Journey Account wallet redeem]] · [[Journey Referral complete on paid order]] ·  
[[Journey Loyalty earn on review]] · [[Journey Loyalty birthday bonus]] ·  
[[Journey Admin loyalty member lookup]] ·  
[[Business Domains MOC]]

#domain #account
