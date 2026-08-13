---
tags: [domain, account]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Loyalty · Wallet · Gift Cards

## Loyalty

- Account points balance + append-only ledger (unique reason/ref for idempotent earn)
- **Earn (live):** paid order, signup, referral, verified review, birthday (cron)  
- **Earn (designed, not wired):** admin adjust (PH-040d)  

- **Redeem** via customer API → wallet credit  
- **Clawback policy:** full order refund reverses order earn from **balance only** (not lifetime)  
- Config: `LOYALTY_*` env → [[Env and config]]  
- Full rules: project `architecture/loyalty.md` · [[Loyalty Backend]]

## Wallet

- One wallet per user (get-or-create)
- **No free deposit**; withdraw → **410 Gone**
- Credits: admin (idempotent), gift redeem, loyalty redeem, refunds, **gateway top-up** (PH-041a API)
- Checkout can offer `wallet` payment method when backend accepts it
- Top-up journey: [[Journey Account wallet top-up]]

## Gift cards

- Admin issue/batch create (integration-tested atomicity)
- Customer **purchase** (PH-042a/b): `POST /gift-cards/purchase` → `gbuy-…` → fulfill on Confirm → `GET /gift-cards/mine`
- Customer redeem → wallet credit (HTTP idempotency + status natural key)
- FE: purchase + mine + redeem on `/account/wallet` · admin gift-cards board
- Journey: [[Journey Gift card purchase]]

## Money retries

Money POSTs should send `Idempotency-Key` — [[Playbook Debug Idempotency]] · [[ADR Idempotency platform]]

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
[[Business Domains MOC]]

#domain #account
