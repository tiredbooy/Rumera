---
tags: [journey, checkout, gift]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Buy as gift

Customer marks the order as a gift, optionally picks packaging / add-ons, and pays
server-priced fees.

## Flow

1. Admin configures `gift` in [[Site Settings]] (enable flags + priced options).
2. Checkout payment step loads public settings (`GET /settings` via BFF).
3. Customer toggles «ارسال به‌عنوان هدیه», multi-selects enabled options, optional message / hide price / preferred delivery date.
4. Summary shows **بسته‌بندی و افزونهٔ هدیه** when fee &gt; 0.
5. `POST /orders` with `is_gift` + `gift_option_ids[]`.
6. [[Orders Backend]] resolves ids → snapshot + fee; total includes fee; rejects unknown/disabled options.
7. Admin `/admin/orders/:id` prints `is_gift` / message / add-on snapshot / notes / preferred delivery when present on GET (PR-062d · [[Admin Console]]).

## Non-goals

- Client-supplied prices (always server)
- Multi-currency packaging SKUs
- Gift cards (separate: [[Journey Gift card purchase]])

## Related

[[Cart and Checkout]] · [[Site Settings]] · [[Orders Backend]] · project API: `apps/backend/docs/api/orders.md` · `site-settings.md`

#journey #checkout
