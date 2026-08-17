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

Each alert is meant to fire **once** (`notified_at` set by the checker job **only after** the email is actually sent — PR-053a).

## Rules (backend)

- Owned by authenticated `userID` — list/delete scoped to owner.
- Create requires valid `product_variant_id`.
- **Restock** alerts are rejected (`conflict`) if the variant **already has available stock** (`on_hand - committed > 0`) — otherwise the job would fire immediately.
- **Restock** alerts are also rejected (`conflict`) if the **inventory row is missing** (PR-053c). Missing stock is not treated as out of stock; create fails closed. A lookup error is `INTERNAL_ERROR` and does not insert.
- Price-drop stores a **reference price** snapshot from the variant at create time; optional `target_price` on the request.

## Lifecycle

1. Customer creates alert (PDP `AlertButton` / API) → [[Product Alerts Backend]]
2. Account list/delete at `/account/alerts` (`AlertsView`) — confirm before `DELETE /alerts/:id`
3. Cron [[Processes and Jobs|alert_check_job]] finds pending alerts whose condition is true
4. Sends email via `notifications.Dispatcher` when wired (outbox if async, inline mail otherwise) — fallback is `pkg/notify` (PR-055a)
5. Marks alert notified **only if dispatch/send succeeded** so it does not re-fire. Dispatcher and mailer both unset, or a send error, leaves `notified_at` NULL → next tick retries. See [[Playbook Debug Product alert notify]].

GET `/alerts` is `{data:[]}` with variant id, type, `target_price`, `notified_at`, `created_at`, plus **product title, slug, and the variant's live `current_price`** (PR-053b). The account page uses those fields; it must not invent a title when they are null (POST create still returns them as `null`). Contract: [alerts.md](../../apps/backend/docs/api/alerts.md).

## Code map

| Layer | Path |
|-------|------|
| Feature slice | `apps/backend/internal/features/alerts/` |
| Cron | `apps/backend/internal/corn/alert_check_job.go` |
| FE types/hooks | `apps/frontend/features/product-alerts/` |
| Account list/delete | `apps/frontend/app/(account)/account/alerts/` + `features/product-alerts/components/alerts-view.tsx` |

## Related

[[Catalogue]] · [[Inventory]] · [[Account Domain]] · [[Notifications]] · [[Journey Product alert notify]] · [[Business Domains MOC]]

#domain
