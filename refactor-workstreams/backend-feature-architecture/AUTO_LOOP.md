# Automatic workstream loop

**Status:** Active  
**Interval:** 7 minutes  
**Scope:** Remaining Phase 2 tasks BE-042 → BE-043 → BE-044  
**Workstream:** `backend-feature-architecture-20260810`

## What it does

On each fire the agent:

1. Reads `TASKS.md`, `IN_PROGRESS.md`, `FINISHED.md`, `CHARTER.md`.
2. If a task is already `IN_PROGRESS`, **continues** it (do not claim a second).
3. Otherwise claims the next remaining task (BE-042, then BE-043, then BE-044).
4. Implements with the same non-negotiables as human agents:
   - no API contract changes
   - green `go build ./...` and scoped `go test`
   - one task at a time
   - document in `FINISHED.md`, remove from `TASKS.md`, clear `IN_PROGRESS.md`
5. Appends a short line to `AUTO_LOOP_LOG.md`.
6. If **all** remaining tasks are done, writes a final log entry and stops claiming work
   (you can cancel the scheduler manually).

## Remaining backlog (at loop start)

| ID | Task |
|----|------|
| BE-042 | Slim `bootstrap/container.go` |
| BE-043 | Remove empty legacy packages |
| BE-044 | Full regression gate |

## How to stop

Ask the agent to cancel the scheduled task, or delete it via the scheduler UI/tool
using the task id recorded in `AUTO_LOOP_LOG.md`.
