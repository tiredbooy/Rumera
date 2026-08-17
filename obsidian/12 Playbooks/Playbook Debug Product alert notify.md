---
tags:
  - playbook
  - alerts
aliases:
  - Debug product alert email
  - Alert notify gate
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug Product alert notify

## Symptoms / when to use

- Shopper subscribed to restock / price-drop and never got mail.
- `product_alerts.notified_at` is set but no email went out (pre-PR-053a bug).
- Pending alerts pile up every cron tick.

## Steps

1. Confirm the row is pending: `notified_at IS NULL` and the restock/price condition is true → [[Product Alerts]]
2. Check API logs for `alert check job: dispatcher and mailer unset; leaving alerts unnotified` — neither `notifications.Dispatcher` nor `notify.Mailer` is wired; **do not** stamp `notified_at` by hand
3. Check `alert check job: send failed` with `alert_id` — that id stays pending; next tick retries. Other ids in the same batch may have been marked if dispatch/send succeeded
4. Trace the job: `apps/backend/internal/corn/alert_check_job.go` via [[Processes and Jobs]] — mark happens **only after** `DispatchAlert` or `mailer.Send`. Async mode enqueues `notification.alert.v1` (`alert:{id}:notify`)
5. Do **not** invent emails or mark notified to “clear the queue”

## Verify

- Dispatcher and mailer unset → `MarkNotified` never called
- Dispatch/send error → that id not marked
- Dispatch/send ok → that id marked
- Tests: `go test ./internal/corn/ -run AlertCheckJob` from `apps/backend`

## Related

[[Journey Product alert notify]] · [[Product Alerts Backend]] · [[Notifications]] · [[Playbooks MOC]]

#playbook
