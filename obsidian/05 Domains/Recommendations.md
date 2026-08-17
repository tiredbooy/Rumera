---
tags: [domain]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Recommendations

Trending / similar / frequently-bought rails.

- Public API `/recommendations/*`
- Frontend `features/recommendations` + home rails
- Admin `/admin/recommendations` — stats + live trending sample. Fetch
  error is a retry card, not an empty catalogue (PR-065b). See [[Admin Console]]
- Cron rebuild inputs → [[Processes and Jobs]]

Checkout FE may still fire `purchase` / `add_to_cart`. **BE owns paid purchase:** `payments.Confirm` writes `purchase` per distinct order-line `product_id` after money/stock commit (PR-050d). Unpaid checkout and orderless Confirm (wallet top-up / gift buy) do not. Cart `AddItem` / bulk add write `add_to_cart`. Unknown `product_id` on `POST /recommendations/interactions` is 404. Inserts are idempotent (same UTC day; purchase also by `metadata.order_id`) so FE retries do not double-weight. Earn is after Confirm, same as loyalty.

Related: [[Catalogue]] · [[Hero and Home]] · [[Analytics]] · [[Storefront Commerce FE]]

#domain
