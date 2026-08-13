# Automatic Refactor-Docs loop

**Status:** Stopped after 082a + 083a complete; 085a blocked on API  
**Interval was:** 15 minutes  
**Workstream:** `gpt56-domain-refactor-20260713`  
**Order:** 082a → 083a → 085a  

## Why 15 minutes

These tasks span backend middleware/routes and frontend capability UI. A 15m
interval gives each fire enough room to implement + verify without stacking
concurrent agents, while still finishing the remaining backlog in a few hours.

## Done definition (loop stops claiming when ALL true)

1. `TASKS.md` remaining open tasks for 082a/083a/085a are **removed** (empty
   Phase L backlog for those IDs).
2. Each completed task has a full record in `FINISHED.md`.
3. `IN_PROGRESS.md` is idle.
4. Verification from the last finished task is green:
   - Backend: `cd apps/backend && go build ./... && go test ./internal/...`
   - Frontend (when FE files touched): `cd apps/frontend && npm exec tsc -- --noEmit`
   - Relevant unit tests for scoped packages.

## Per-fire protocol

See the scheduled prompt. Log every fire in `AUTO_LOOP_LOG.md`.

## Stop

Cancel scheduler task id recorded in `AUTO_LOOP_LOG.md`, or ask the agent to
cancel when Phase L remaining work is complete.
