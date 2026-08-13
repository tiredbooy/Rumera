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

Stats, revenue, **search analytics** (not Meili indexer), recommendations, alerts,
**cellar-box renewal email** (no charge — [[Subscriptions Backend]]), idempotency cleanup.

## Detached request work (PH-013a)

OTP SMS, password-reset / order emails, blog read + recipe view counters, analytics push: use **`pkg/async.Go` / `GoCtx`** (recover + timeout). Raw `go func()` after the handler is **outside** Gin Recovery — a panic kills the process.

See [[Pitfalls and anti-patterns]].

Related: [[Backend API]] · [[Runtime Topology]] · [[Analytics]] · [[Search Backend]]

Bridge: `apps/backend/docs/architecture/processes-and-jobs.md`

#backend #ops
