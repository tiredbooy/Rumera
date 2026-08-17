---
tags:
  - backend
  - ops
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Processes and Jobs

## Binaries (`cmd/`)

| Binary | Role |
|--------|------|
| server | API + queue + cron |
| seed | [[Seed and Demo Data]] |
| notification-worker | [[Notifications]] |
| media-reconcile | [[Media Pipeline]] orphan GC |

## In-process cron (`internal/corn`)

Stats, revenue, **search analytics** (not Meili indexer), recommendations, alerts
([[Product Alerts Backend]] — dispatcher when wired, PR-055a; mark notified only
after dispatch/send, PR-053a),
**cellar-box renewal email** (no charge — [[Subscriptions Backend]]; dispatcher
when wired, PR-055a; PR-057a advances `next_renewal_at` only after dispatch/send),
idempotency cleanup,
**reservation TTL sweeper** (PR-020c — every 5m: unpaid `pending` older than 30m →
`payment_failed` + release committed stock via [[Inventory Backend]] + fail dangling
`payment_transactions`; coupon usage leftover is PR-020j). See [[Orders Backend]].
Leftover order-earn rows (`payment_loyalty_awards`) are retried from Confirm via
`ProcessPendingLoyaltyAwards` (PR-003h; no dedicated cron yet).

## Detached request work (PH-013a)

OTP SMS, password-reset / order emails, blog read + recipe view counters, analytics push: use **`pkg/async.Go` / `GoCtx`** (recover + timeout). Raw `go func()` after the handler is **outside** Gin Recovery — a panic kills the process.

See [[Pitfalls and anti-patterns]].

Related: [[Backend API]] · [[Runtime Topology]] · [[Analytics]] · [[Search Backend]] · [[Orders Backend]] · [[Inventory Backend]]

Bridge: `apps/backend/docs/architecture/processes-and-jobs.md`

#backend #ops
