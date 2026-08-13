---
tags:
  - domain
  - account
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Account Domain

Signed-in customer world: profile, orders, addresses, wishlist, taste, rewards, wallet, subscriptions, reviews, settings.

## Backend packages (feature migration)

| Concern | Package |
|---------|---------|
| Profile / admin users | `features/users` |
| Login / OTP / sessions | `features/auth` · [[Auth and Sessions]] |
| Addresses | `features/addresses` · [[Addresses Backend]] |
| Wishlist | `features/wishlist` · [[Wishlist Backend]] |
| Wallet | `features/wallet` · [[Wallet Backend]] |
| Loyalty | `features/loyalty` · [[Loyalty Backend]] |
| Referral | `features/referral` · [[Referral Backend]] |
| Gift cards | `features/giftcard` · [[Gift Card Backend]] |
| Subscriptions | `features/subscription` · [[Subscriptions Backend]] |
| Alerts | `features/alerts` · [[Product Alerts Backend]] |
| Taste profile | `features/taste` · [[Taste Profile Backend]] |

UI map: [[Account FE]]  
Auth: [[Auth and Sessions]]  
Money-ish: [[Loyalty Wallet Gift Cards]] · [[Orders]] · [[Payments]]  
Architecture: [[ADR Backend feature packages]]

#domain #account
