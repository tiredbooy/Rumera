# Production Hardening + Product UX + Documentation

**Workstream ID:** `production-hardening-product-20260811`  
**Created:** 2026-08-11  
**Status:** Backlog only (no implementation until user says go)  
**Supersedes claims from:** prior “highest ROI” crawl items **#2–#5** and **#6–#8**, plus product UX follow-ups, with product constraints locked below.

## Why this workstream exists

Backend feature-architecture (Phase 2) and Refactor-Docs 082a/083a are done.
There is no server/CI use case for this founder right now. The next program is:

1. **Trust & money safety** (idempotency production-grade, fake-tx, models discipline)
2. **Operator completeness** (RBAC residual, inventory weight / 085a)
3. **Discoverability** (search quality / Meili readiness)
4. **Growth loops that fit e-commerce** (loyalty triggers first; gift cards; wallet top-up; box subscriptions — not Netflix)
5. **Documentation that teaches the system** — both **project docs** and **Obsidian project brain**

## Product constraints (locked)

| Topic | Decision |
| --- | --- |
| **CI / GitHub Actions / deploy workflows** | **Out of scope.** No server → do not build or maintain CI. Local `go test` / manual verify only. |
| **Subscriptions** | **E-commerce box model** (recurring physical box, pause/skip/cancel, renewal email, optional contents). **Not** Netflix-style unlimited digital access. Improve what exists; do not rebuild as streaming SaaS. |
| **Loyalty** | **Highest product priority.** Triggers (earn on review, birthday, purchase, admin-tunable rates) are the growth lever — invest heavily. |
| **Gift cards** | Customer **purchase** flow (today staff-issue only) is in scope. |
| **Wallet top-up** | Gateway-funded customer top-up (not free money) in scope; depends on production idempotency. |
| **Multi-currency** | **Not now.** Single currency (Toman). |
| **Multi-warehouse** | **Not now.** Single inventory location model. |
| **Crypto payments** | **Future maybe** — document as deferred only; do not implement. |
| **Multi-tenant** | Not in scope. |

## Documentation dual-track (mandatory on every epic)

Every epic that changes behaviour or architecture must update **both**:

1. **Project docs** (repo source of truth for engineers)
   - Root: `docs/` (system map, roadmap, testing notes when relevant)
   - Backend: `apps/backend/docs/` (`architecture.md`, `architecture/*`, `api/*`, `how-it-works.md`, domain guides)
   - Frontend: `apps/frontend/docs/` when FE surface changes
2. **Obsidian project brain** (graph / understanding vault)
   - `obsidian/02 Architecture/`, `03 Backend/`, `05 Domains/`, `09 Journeys/`, `11 Decisions/`, `Brain/`
   - New ADRs for material decisions; journey notes for customer/admin flows; domain notes stay linked from MOCs

**Rule:** If it is not in both places (or explicitly linked from Brain → project path), the task is not finished.

## Non-negotiables for later implementation

1. One lettered task at a time: claim `IN_PROGRESS.md` → implement → verify → `FINISHED.md` → clear claim.
2. Prefer no silent API contract breaks; document intentional contract extensions.
3. Money paths: atomic txs, lock ordering, idempotency keys, no free money endpoints.
4. No CI files or workflow maintenance as part of this workstream.
5. Document first or in the same task as code for #4 (idempotency) and all product UX.

## Explicitly out of scope

- CI/CD pipelines, GitHub Actions, deploy workflows
- Multi-currency, multi-warehouse, multi-tenant
- Crypto payment rails (deferred note only)
- Netflix-style digital subscription product redesign
- Microservice split / rewrite-for-fun
