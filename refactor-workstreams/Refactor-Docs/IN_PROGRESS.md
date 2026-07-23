# Active Refactor Task

**Workstream ID:** `gpt56-domain-refactor-20260713`
**Rule:** This file contains at most one active task.

## Task 057c - Make Media Lifecycle And Cache Behavior Durable

**Started:** 2026-07-22

Delete replaced or removed originals and rendered derivatives, clean files after
product cascades, release cancelled standalone uploads, and provide an auditable
orphan-reconciliation dry run. Coordinate cache invalidation after media writes
and verify local development, Docker persistence, backup/restore, and
multi-process serving behavior. Keep Task 057d processing hardening and Task 061d
cross-origin URL resolution outside this task.
