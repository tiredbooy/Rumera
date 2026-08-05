---
tags: [domain]
aliases:
  - Cellar box
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Subscriptions

## What it is

Recurring **“cellar box”** plan for customers: cadence, delivery address, lifecycle status, next renewal date.

## Plan & cadence

| Field | Values (current) |
|-------|------------------|
| Plan | fixed `"cellar-box"` on create |
| Cadence | `monthly` · `quarterly` |
| Status | `active` · `paused` · `cancelled` |
| Actions | `pause` · `resume` · `cancel` · `skip` (push next renewal one cadence) |

## What renewal does **not** do yet

Cron emails “your box is ready” and advances `next_renewal_at`.  
**Charging is intentionally not implemented** here yet (awaits tokenized recurring payment — see feature roadmap). Do not document fake auto-charge.

## Surfaces

- Account: `/account/subscriptions` → [[Account FE]]
- API: customer subscription create/list/update

## Code map

| Layer | Path |
|-------|------|
| Service | `internal/services/subscription_svc.go` |
| Cron | `internal/corn/subscription_renewal_job.go` |
| FE | `features/subscriptions/` |

## Related

[[Subscriptions Backend]] · [[Account Domain]] · [[Orders]] · [[Payments]] · [[Journey Subscription renewal email]] · [[Business Domains MOC]]

#domain
