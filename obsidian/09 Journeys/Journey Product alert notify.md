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
4. `alert_check_job` selects pending → `Dispatcher.DispatchAlert` (or inline mailer) → marks notified **only after dispatch/send succeeds** (PR-053a / PR-055a)
5. Customer returns via email / PDP → may add to cart → [[Cart and Checkout]]

## Failure branches

- Create restock while available → API conflict
- Create restock when inventory row is missing → API conflict (fail-closed; not treated as OOS) — PR-053c
- Dispatcher and mailer unset → log error; **do not** mark; next tick retries → [[Playbook Debug Product alert notify]]
- Dispatch/send fail → log warn; that id stays pending; successes in the same batch still mark
- Duplicate fire blocked by `notified_at` (set only after a real dispatch/send)

## Domains touched

[[Product Alerts]] · [[Inventory]] · [[Catalogue]] · [[Notifications]] · [[Processes and Jobs]]

## Related

[[Journeys MOC]] · [[Product Alerts Backend]]

#journey
