# refactor-workstreams

**Cleaned 2026-08-17.** This directory used to hold agent-loop scaffolding
(`AUTO_LOOP.md`, `AUTO_LOOP_LOG.md`, `LOOP_LOCK.md`, `IN_PROGRESS.md`,
`RESUME-TOMORROW.md`) for automated runs. That scaffolding is **deleted** — it was
scheduler state with no lasting value.

## The assignable board is `/TASKS.md` at the repo root

Everything you actually work from lives there. This directory is now only reference
detail and history.

## Live

| Path | Why it is here |
| --- | --- |
| `event-driven-and-capacity/TASKS.md` | Design detail behind the remaining event tasks the root board references |
| `event-driven-and-capacity/CHARTER.md` | The binding rules — HTTP stays HTTP, events never become the ledger |
| `event-driven-and-capacity/findings-ed-catalog.md` | The analysis behind the catalog/cache backlog (ED-020…026) |
| `event-driven-and-capacity/findings-k6.md` | The load-test suite and how to run it |
| `event-driven-and-capacity/FINISHED.md` | Record of the event bus that shipped, including bugs found and what is still open |
| `backend-feature-architecture/CHARTER.md` | Kept **in place** — 32 backend doc files link to this exact path |

## `_archive/`

Completed workstreams, kept only because 35 of those files were never committed to
git and deleting them would be permanent:

- `Refactor-Docs/` — the original refactor program
- `production-readiness/` — PR-* program (findings + 4,949-line completion log)
- `production-hardening-and-product/` — PH-* program
- `backend-feature-architecture/` — BE-* program (its CHARTER stayed live)
- `event-driven-and-capacity/` — the ED findings whose work has shipped

Nothing in the live tree references `_archive/`. **Delete it whenever you want:**

```bash
rm -rf refactor-workstreams/_archive
```

Before you do, note it contains the only copy of the production-readiness findings —
they are untracked, so they are gone for good once removed. They are historical
analysis of work already completed, so that is probably fine.
