---
tags: [domain, account]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Loyalty · Wallet · Gift Cards

## Loyalty

- Account points balance + ledger
- **Earn** on paid orders (`AwardForOrder`) after [[Payments]] confirm — not on mere order create
- **Redeem** via customer API
- Config: `LOYALTY_*` → [[Env and config]]
- Referral awards also credit loyalty → [[Referrals]]

## Wallet

- One wallet per user (get-or-create)
- Transactions ledger; deposit/withdraw APIs exist
- Storefront UI may emphasize gift-card redeem + “top-up coming soon”
- Checkout can offer `wallet` payment method when backend accepts it

## Gift cards

- Admin issue/batch create (integration-tested atomicity)
- Customer redeem → wallet credit
- FE: wallet redeem component · admin gift-cards board

## Code map

| Area | Path |
|------|------|
| Loyalty FE | `features/loyalty/` |
| Wallet FE | `features/wallet/` · account wallet view |
| Gift cards FE | `features/gift-cards/` · admin |
| BE | loyalty / wallet / gift_card services |

## Related

[[Account Domain]] · [[Account FE]] · [[Referrals]] · [[Payments]] · [[Journey Account wallet redeem]] · [[Journey Referral complete on paid order]] · [[Business Domains MOC]]

#domain #account
