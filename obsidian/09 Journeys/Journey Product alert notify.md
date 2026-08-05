---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Product alert notify

## Actor

Shopper + system cron

## Happy path

1. Shopper on OOS or expensive variant creates alert (`restock` / `price_drop`) → [[Product Alerts]]
2. Alert stored with reference price; restock only if currently unavailable
3. Later, stock returns or price drops
4. `alert_check_job` selects pending → emails customer → marks notified
5. Customer returns via email / PDP → may add to cart → [[Cart and Checkout]]

## Failure branches

- Create restock while available → API conflict
- Mailer down → log warn; job should not infinite-loop (mark only sent IDs)
- Duplicate fire blocked by `notified_at`

## Domains touched

[[Product Alerts]] · [[Inventory]] · [[Catalogue]] · [[Notifications]] · [[Processes and Jobs]]

## Related

[[Journeys MOC]] · [[Product Alerts Backend]]

#journey
