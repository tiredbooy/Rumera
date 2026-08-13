# Backlog pointer — Production hardening + product UX

**Status:** **COMPLETE** (lettered backlog, 2026-08-12). Phases **0–6** done including PH-043c (auto-charge **declined** by decision) and PH-060 gift options.  
Workstream: `refactor-workstreams/production-hardening-and-product/`  
Dual-doc matrix: [`PH-DUAL-DOC-MATRIX.md`](./PH-DUAL-DOC-MATRIX.md) · founder tour: [`READ-THE-SYSTEM.md`](./READ-THE-SYSTEM.md).

**Canonical task list:**

[`refactor-workstreams/production-hardening-and-product/TASKS.md`](../refactor-workstreams/production-hardening-and-product/TASKS.md)

**Charter (constraints, dual-doc rules, product decisions):**

[`refactor-workstreams/production-hardening-and-product/CHARTER.md`](../refactor-workstreams/production-hardening-and-product/CHARTER.md)

## Short summary of order

1. ~~**Phase 0**~~ Dual-doc rules + architecture deep-dive + money/stock saga docs + deferred decisions — **done**  
2. ~~**Phase 1**~~ Fake txs → idempotency → models/errors → background safety / metrics / tests — **done**  
3. ~~**Phase 2**~~ Inventory weight + RBAC residual — **done**  
4. ~~**Phase 3**~~ Search quality + Meili readiness — **done** (cutover deferred)  
5. ~~**Phase 4**~~ Loyalty → wallet top-up → gift cards → box subs (not Netflix) — **done** (PH-043c closed as no auto-charge)  
6. ~~**Phase 5**~~ Dual-doc consistency gate: **PH-050a** + **PH-050b** one-hour outline — **done**  

## Explicitly excluded

- CI / GitHub Actions / deploy workflows (no server for now)  
- Multi-currency, multi-warehouse, crypto payments (crypto maybe later — docs only)  
- Netflix-style digital subscriptions  
- ~~PH-043c auto-charge~~ closed — email renewal only (decision doc)  

## Dual documentation

Every epic updates **project docs** (`docs/`, `apps/*/docs/`) **and** **Obsidian brain** (`obsidian/`).
Closure checklist: [PH-DUAL-DOC-MATRIX.md](./PH-DUAL-DOC-MATRIX.md).
