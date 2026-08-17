---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Subscription renewal email (box due)

## Product framing

This is a **physical box due reminder** (PH-043b RTL email), not a streaming
renewal bill. The job does **not** charge a card or open a digital entitlement.

## Actor

System cron + cellar-box subscriber

## Happy path

1. Active subscription with `next_renewal_at` ≤ now → [[Subscriptions]]
2. `subscription_renewal_job` loads due rows (limit 500; active + user active)
3. Email: subject «باکس سرداب شما آماده است»
   - HTML `lang=fa` `dir=rtl`
   - Reminder + no auto-pay honesty
   - CTA «مدیریت باکس در حساب من» → `/account/subscriptions`
4. Advance `next_renewal_at` by one cadence (`NextRenewal`) **only after dispatch/send succeeds** (PR-057a / PR-055a). Mail goes through [[Notifications]] dispatcher when wired (`subscription:{id}:renewal:{YYYY-MM-DD}`).

## Failure branches

- Dispatcher and mailer unset → logged; **date does not advance**; next tick retries
- Dispatch/email fail → logged; **date does not advance** for that id; next tick retries
- Advance SQL fail → logged; row may remain due next tick
- Paused / cancelled → never selected by `FindDue`

## Money

**None.** Charging declined for this program ([[ADR Box auto-charge declined]] / PH-043c).
Do not document this journey as “billing ran.”

## Domains touched

[[Subscriptions]] · [[Account Domain]] · [[Processes and Jobs]]

## Related

[[Journeys MOC]] · [[Subscriptions Backend]] · [[Journey Manage cellar box]] ·
[[Playbook Debug Subscription renewal email]] · [[Known gaps]] (charging) ·
project `architecture/box-subscriptions.md` · `subscription.ProcessDueRenewals`

#journey
