# Automatic production-hardening loop

**Status:** **COMPLETE** (lettered backlog empty 2026-08-12) — cancel scheduler or leave idle  
**Interval:** **60 seconds** (historical)  
**Scheduler id:** `019ff481c40d`  
**Workstream:** `production-hardening-product-20260811`  
**Directory:** `refactor-workstreams/production-hardening-and-product/`

## Quality bar

Perfect logic, clean code, surgical diffs. Dual-doc for material changes. No CI.
No multi-currency / multi-warehouse / crypto / Netflix-style subs.
**User-clear errors (PH-012c/d):** never ship generic-only failures when the
API already knows the cause — actionable `code` + `message` (BE) and surface them (FE).

## Claim order (do not skip)

1. ~~PH-000a–d~~ done  
2. ~~PH-010a~~ done  
3. ~~PH-011a–e~~ done  
4. ~~PH-012a–b~~ done  
5. ~~PH-013a~~ done  
6. ~~PH-012c–d~~ done (user-clear errors)  
7. ~~PH-013b–c~~ done  
8. ~~PH-020a–c~~ done  
9. ~~PH-021a–b~~ done  
10. ~~PH-030a~~ done  
11. ~~PH-030b~~ done  
12. ~~PH-040a~~ done  
13. ~~PH-040b~~ done  
14. ~~PH-040c~~ done  
15. ~~PH-040d~~ done  
16. ~~PH-040e~~ done  
17. ~~PH-041a~~ done  
18. ~~PH-041b~~ done  
19. ~~PH-042a~~ done  
20. ~~PH-042b~~ done  
21. ~~PH-043a~~ done  
22. ~~PH-043b~~ done  
23. ~~PH-050a~~ done  
24. ~~PH-050b~~ done  
25. **STOP** — lettered backlog empty  


**User priority add (2026-08-12):** PH-012c/d — never leave users with only
“something went wrong”; backend messages + FE must explain what failed.

Full text: `TASKS.md`.

## Per-fire protocol

1. Read `IN_PROGRESS.md`. Finish mid-flight claims.  
2. Else claim next open lettered task.  
3. Implement + dual-doc + local verify (`go build` / scoped tests).  
4. FINISHED.md + TASKS `[x]` + log.  
5. Never exit “idle only” when open `[ ]` tasks remain.
