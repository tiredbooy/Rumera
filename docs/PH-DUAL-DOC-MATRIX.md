# Production-hardening dual-doc matrix (PH-050a)

**Program:** `production-hardening-product-20260811`  
**Canonical tasks:** `refactor-workstreams/production-hardening-and-product/TASKS.md`  
**Process:** [DOCUMENTATION-DUAL-TRACK.md](./DOCUMENTATION-DUAL-TRACK.md)

This page is the **closure map**: every lettered PH epic that shipped behaviour or
architecture has **both** project depth and an Obsidian home. Orphans = unfinished docs.

**Status legend:** ✅ both tracks · 📄 project-only acceptable (no new journey) · ⏳ residual

---

## Phase 0 — Documentation OS

| Task | Project docs | Obsidian |
|------|--------------|----------|
| PH-000a Dual-doc playbook | [DOCUMENTATION-DUAL-TRACK.md](./DOCUMENTATION-DUAL-TRACK.md) | [[Playbook Document a change]] · [[Documentation Bridge]] |
| PH-000b Architecture pack | [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md), BE [architecture/](../apps/backend/docs/architecture/README.md) | [[System Atlas]] · [[Layered Backend]] · Connect files |
| PH-000c Money/stock sagas | [money-and-stock-sagas.md](../apps/backend/docs/architecture/money-and-stock-sagas.md) | [[Money and stock rules]] · payment/order journeys |
| PH-000d Deferred decisions | FEATURE-ROADMAP deferred table | [[ADR Deferred product and platform]] · [[Known gaps]] |

---

## Phase 1 — Correctness

| Task | Project docs | Obsidian |
|------|--------------|----------|
| PH-010a Blog/recipe txs | feature packages + tests | (code-path; domain Recipes/Journal notes) |
| PH-011a–e Idempotency | [idempotency.md](../apps/backend/docs/architecture/idempotency.md) · [runbook](../apps/backend/docs/architecture/idempotency-runbook.md) | [[ADR Idempotency platform]] · [[Journey Idempotent retry checkout webhook]] |
| PH-012a Models ownership | [domain-map.md](../apps/backend/docs/architecture/domain-map.md) · conventions | [[Backend Domain Map]] · [[ADR Backend feature packages]] |
| PH-012b Error mapping | [error-messages.md](../apps/backend/docs/architecture/error-messages.md) | Backend notes (HandleError) |
| PH-012c BE clear errors | same error-messages catalogue | Known gaps residual NextAuth |
| PH-012d FE clear errors | FE user-facing-error + money path wiring | Account FE / money journeys |
| PH-013a Async safety | [processes-and-jobs.md](../apps/backend/docs/architecture/processes-and-jobs.md) | [[Processes and Jobs]] · pitfalls |
| PH-013b Metrics/spans | observability + saga docs | Processes and Jobs |
| PH-013c Critical tests | [TESTING.md](./TESTING.md) | Testing note |

---

## Phase 2 — Operator trust

| Task | Project docs | Obsidian |
|------|--------------|----------|
| PH-020a–c Weight | [inventory.md](../apps/backend/docs/architecture/inventory.md) · FE inventory/checkout | [[Inventory]] · [[Journey First purchase]] / shipping truth |
| PH-021a–b RBAC | [rbac.md](../apps/backend/docs/architecture/rbac.md) · FE rbac | [[RBAC]] · admin playbooks |

---

## Phase 3 — Search

| Task | Project docs | Obsidian |
|------|--------------|----------|
| PH-030a ILIKE quality | [search.md](../apps/backend/docs/architecture/search.md) · FE search | [[Search]] · [[Search Backend]] · [[Journey Search to PDP]] |
| PH-030b Meili readiness | same (no storefront cutover) | [[ADR Search ILIKE until Meili]] · Known gaps residual cutover |

---

## Phase 4 — Product growth

| Task | Project docs | Obsidian |
|------|--------------|----------|
| PH-040a–e Loyalty | [loyalty.md](../apps/backend/docs/architecture/loyalty.md) · api/loyalty · FE loyalty | [[Loyalty Wallet Gift Cards]] · [[Loyalty Backend]] · Journey Loyalty * |
| PH-041a–b Wallet top-up | [wallet-topup.md](../apps/backend/docs/architecture/wallet-topup.md) · api/wallet · FE wallet | [[Wallet Backend]] · [[Journey Account wallet top-up]] |
| PH-042a–b Gift purchase | [gift-card-purchase.md](../apps/backend/docs/architecture/gift-card-purchase.md) · api/gift-cards · FE gift-cards | [[Gift Card Backend]] · [[Journey Gift card purchase]] |
| PH-043a–b Box subs | [box-subscriptions.md](../apps/backend/docs/architecture/box-subscriptions.md) · api/subscriptions · FE subscriptions | [[Subscriptions]] · [[Subscriptions Backend]] · Journey Manage cellar box · renewal email |
| PH-043c Auto-charge | **closed — declined** (`box-auto-charge-decision.md`) | ADR Box auto-charge declined |

---

## Phase 5 — Closure

| Task | Project docs | Obsidian |
|------|--------------|----------|
| **PH-050a** this matrix | this file · DOCUMENTATION-MAP · FEATURE-ROADMAP · IMPROVEMENT status | Connect * · Journeys MOC · Docs Bridge · Known gaps |
| **PH-050b** One-hour outline | [READ-THE-SYSTEM.md](./READ-THE-SYSTEM.md) · [README.md](./README.md) | [[Project Brain]] “Read the system in one hour” |

---

## Journey coverage (no orphans)

All files under `obsidian/09 Journeys/` must appear in [[Journeys MOC]] and
[[Connect 09 Journeys]]. PH-era additions:

| Journey | PH |
|---------|-----|
| Journey Idempotent retry checkout webhook | PH-011 |
| Journey Loyalty earn on review / birthday / first purchase | PH-040 |
| Journey Account wallet top-up | PH-041 |
| Journey Gift card purchase | PH-042 |
| Journey Manage cellar box · Subscription renewal email | PH-043 |

---

## Explicit non-goals (still deferred)

| Item | Where recorded |
|------|----------------|
| CI / GitHub Actions | CHARTER · FEATURE-ROADMAP · ADR Deferred |
| Multi-currency / multi-warehouse | same |
| Crypto rails | same |
| Netflix-style digital subs | box-subscriptions.md · ADR Deferred |
| Meili **storefront cutover** | search.md · Known gaps |
| PH-043c tokenized auto-charge | closed (declined) |

---

## Residual gaps after this program (product)

1. Gateway **redirect URL** embedding (wallet top-up / gift purchase UX polish)  
2. Gift code **email delivery** (mine list only today)  
3. Subscription **change address** on existing row; list **LIMIT**  
4. Loyalty **DB-tunable rates** / admin adjust API  
5. Meili cutover when ready  
6. Compose Prometheus scrape profile (code metrics exist; ops wiring residual)

---

## Related

- Workstream FINISHED: `refactor-workstreams/production-hardening-and-product/FINISHED.md`  
- [BACKLOG-PRODUCTION-HARDENING.md](./BACKLOG-PRODUCTION-HARDENING.md)  
- Obsidian [[Known gaps]] · [[Documentation Bridge]]
