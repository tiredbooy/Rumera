---
tags: [backend]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Subscriptions Backend

## Service

`SubscriptionService`:

- **Create** — plan `cellar-box`, cadence + optional address, `NextRenewal` from now
- **List** — by user
- **Update** — pause/resume/cancel/skip only; invalid action → invalid request

## Cron

`SubscriptionRenewalJob`:

- `FindDue` up to 500
- Email Persian subject/body with link to `/account/subscriptions`
- `AdvanceRenewal` even if email fails (log warn on send failure)

No order/payment creation in this job today.

## Related

[[Subscriptions]] · [[Processes and Jobs]] · [[Notifications]] · [[Account Domain]]

#backend
