---
tags:
  - backend
  - map
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Backend Domain Map

Capability → packages (mental index). Prefer `features/*` when listed.

| Capability | Package | Notes |
|------------|---------|-------|
| Auth / OTP / tokens | **`features/auth`** | [[Auth and Sessions]] |
| Users / admin customers | **`features/users`** | RegisterAdmin |
| Panel RBAC | **`features/rbac`** | [[RBAC]] — package ready |
| Addresses | **`features/addresses`** | [[Addresses Backend]] |
| Wishlist | **`features/wishlist`** | [[Wishlist Backend]] |
| Wallet | **`features/wallet`** | [[Wallet Backend]] |
| Site settings | **`features/site_settings`** | [[Site Settings Backend]] |
| Hero slides | **`features/hero`** | [[Hero Slides Backend]] |
| Blog / journal | **`features/blog`** | [[Blog Backend]] |
| Recipes | **`features/recipes`** | [[Recipes Backend]] |
| Reviews | **`features/reviews`** | [[Reviews Backend]] |
| Recommendations | **`features/recommendations`** | [[Recommendations Backend]] |
| Coupons | **`features/coupons`** | [[Coupons Backend]] |
| Shipping | **`features/shipping`** | [[Shipping Backend]] |
| Taste Profile | **`features/taste`** | [[Taste Profile Backend]] |
| Product Alerts | **`features/alerts`** | [[Product Alerts Backend]] |
| Subscriptions | **`features/subscription`** | [[Subscriptions Backend]] |
| Gift Card | **`features/giftcard`** | [[Gift Card Backend]] |
| Referral | **`features/referral`** | [[Referral Backend]] |
| Loyalty | **`features/loyalty`** | [[Loyalty Backend]] |
| Products / variants | legacy handlers | [[Catalogue]] |
| Categories / brands / tags | legacy | |
| Cart | **`features/cart`** | [[Cart and Checkout]] · [[Cart Backend]] |
| Orders | **`features/orders`** | [[Orders]] · [[Orders Backend]] |
| Inventory | **`features/inventory`** | [[Inventory Backend]] |
| Payments / webhooks | **`features/payments`** | [[Payments Backend]] |
| Media | **`features/media`** | [[Media Pipeline]] · [[Media Backend]] |
| Wallet / loyalty / gift / taste | (see rows above) | [[Loyalty Wallet Gift Cards]] |
| Notifications | `internal/notifications` | [[Notifications]] |

Full table: `apps/backend/docs/architecture/domain-map.md`  
Architecture decision: [[ADR Backend feature packages]]

Related: [[Backend API]] · [[Backend package map]] · [[Business Domains MOC]]

#backend #map
