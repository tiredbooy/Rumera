---
tags: [domain, admin]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Site Settings

Global site configuration (maintenance, free shipping threshold, etc.).

- Admin settings board
- BE `site_settings` service
- Affects checkout UX when free-shipping threshold set

## Gift checkout options (PH-060)

Modular **buy as gift** config lives in the `gift` JSONB group:

- `enabled`, `messageEnabled`, `messageMaxLength`, `hidePriceEnabled`
- `options[]` = `{ id, label, description, price, enabled, sortOrder }`

Public `GET /settings` exposes normalized gift config (defaults: gift on + free `gift_wrap`).  
Admin `PUT` replaces the whole group. **Prices are never trusted from the client** — [[Orders Backend]] re-resolves selected ids on create.

FE: admin tab «هدیه» — visual option list (add / remove / reorder / price / enable) · checkout loads gift via public BFF.

Related: [[Admin Console]] · [[Shipping and Coupons]] · [[Cart and Checkout]] · [[Orders Backend]] · [[Journey Buy as gift]]

#domain
