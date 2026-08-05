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

Stats, revenue, **search analytics** (not Meili indexer), recommendations, alerts, subscription renewal, idempotency cleanup.

Related: [[Backend API]] · [[Runtime Topology]] · [[Analytics]] · [[Search Backend]]

Bridge: `apps/backend/docs/architecture/processes-and-jobs.md`

#backend #ops
