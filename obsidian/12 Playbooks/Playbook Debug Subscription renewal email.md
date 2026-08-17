---
tags:
  - playbook
  - subscriptions
aliases:
  - Debug cellar box renewal email
  - Box renewal notify gate
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug Subscription renewal email

## Symptoms / when to use

- Active cellar-box is due (`next_renewal_at` ≤ now) and the customer never got mail.
- `next_renewal_at` rolled forward but no reminder went out (pre-PR-057a bug).
- The same due rows keep appearing every cron tick.

## Steps

1. Confirm the row is due: `status = active` and `next_renewal_at <= now` → [[Subscriptions]]
2. Check API logs for `subscription renewal job: dispatcher and mailer unset; leaving renewals unadvanced` — neither dispatcher nor mailer is wired; **do not** advance `next_renewal_at` by hand
3. Check `subscription renewal job: send failed` with `sub_id` — that id stays due; next tick retries. Other ids in the same batch may have advanced if dispatch/send succeeded
4. Trace: `subscription.ProcessDueRenewals` via `apps/backend/internal/corn/subscription_renewal_job.go` — [[Processes and Jobs]] — date rolls **only after** `DispatchSubscriptionRenewal` or `mailer.Send`. Async key is `subscription:{id}:renewal:{YYYY-MM-DD}`
5. Do **not** invent a charge or roll the date to “clear the queue”

## Verify

- Dispatcher and mailer unset → `AdvanceRenewal` never called
- Dispatch/send error → that id not advanced
- Dispatch/send ok → that id advanced by one cadence
- Tests: `go test ./internal/features/subscription/ -run ProcessDueRenewals ./internal/corn/ -run SubscriptionRenewalJob` from `apps/backend`

## Related

[[Journey Subscription renewal email]] · [[Subscriptions Backend]] · [[ADR Box auto-charge declined]] · [[Notifications]] · [[Playbooks MOC]]

#playbook
