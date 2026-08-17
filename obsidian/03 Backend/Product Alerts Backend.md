---
tags: [backend, account, alerts]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Product Alerts Backend

Restock / price-drop alerts + cron

`GET /alerts` hydrates `product_title`, `product_slug`, and variant `current_price` via JOIN so the account list needs no second hop (PR-053b). `ListByUser` is capped at `LIMIT 100`. POST create is still variant-id only (enrichment keys JSON `null`). Restock create **fails closed** on a missing inventory row (`CONFLICT`, not an implicit OOS success) — PR-053c. Contract: [alerts.md](../../apps/backend/docs/api/alerts.md).

`alert_check_job` (`internal/corn`) emails pending alerts via `notifications.Dispatcher.DispatchAlert` when wired (PR-055a), else inline mailer, then stamps `notified_at` **only after** a successful dispatch/send (PR-053a). Unset dispatcher+mailer logs and leaves rows unnotified so the next tick can retry. Failures do not invent emails. See [[Journey Product alert notify]] · [[Playbook Debug Product alert notify]].

## Package (feature slice)

```text
apps/backend/internal/features/alerts/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

Mounted via `RegisterCustomer` / `RegisterAdmin` from `internal/routes/routes.go`.

## Related

[[Account Domain]] · [[ADR Backend feature packages]] · [[Backend package map]] · [[Product Alerts]] · [[Processes and Jobs]]

#backend #alerts
