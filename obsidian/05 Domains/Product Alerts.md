---
tags: [domain]
aliases:
  - Back in stock
  - Price drop alerts
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Product Alerts

## What it is

Customers subscribe to a **variant** for either:

| `alert_type` | Meaning |
|--------------|---------|
| `restock` | Notify when available stock becomes positive |
| `price_drop` | Notify when price falls (uses reference/target prices) |

Each alert is meant to fire **once** (`notified_at` set by the checker job).

## Rules (backend)

- Owned by authenticated `userID` — list/delete scoped to owner.
- Create requires valid `product_variant_id`.
- **Restock** alerts are rejected (`conflict`) if the variant **already has available stock** (`on_hand - committed > 0`) — otherwise the job would fire immediately.
- Price-drop stores a **reference price** snapshot from the variant at create time; optional `target_price` on the request.

## Lifecycle

1. Customer creates alert (PDP / API) → [[Product Alerts Backend]]
2. Cron [[Processes and Jobs|alert_check_job]] finds pending alerts whose condition is true
3. Sends email via mailer (`pkg/notify`) — **not** necessarily the Kafka notification path today
4. Marks alert notified so it does not re-fire

## Code map

| Layer | Path |
|-------|------|
| Feature slice | `apps/backend/internal/features/alerts/` |
| Cron | `apps/backend/internal/corn/alert_check_job.go` |
| FE types/hooks | `apps/frontend/features/product-alerts/` |

## Related

[[Catalogue]] · [[Inventory]] · [[Account Domain]] · [[Notifications]] · [[Journey Product alert notify]] · [[Business Domains MOC]]

#domain
