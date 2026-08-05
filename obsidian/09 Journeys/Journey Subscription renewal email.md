---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Subscription renewal email

## Actor

System cron + subscriber

## Happy path

1. Active subscription with `next_renewal_at` due → [[Subscriptions]]
2. `subscription_renewal_job` finds due rows
3. Email “box is ready” + link to `/account/subscriptions`
4. Advance next renewal by cadence

## Failure branches

- Email fail → logged; renewal still advances (check job code)
- **No charge** in this journey yet — payment not automated

## Domains touched

[[Subscriptions]] · [[Account Domain]] · [[Processes and Jobs]]

## Related

[[Journeys MOC]] · [[Subscriptions Backend]] · [[Known gaps]] (charging)

#journey
