# Production Hardening + Product UX + Docs — Ordered Backlog

**Workstream:** `production-hardening-product-20260811`  
**Created:** 2026-08-11  
**Mode:** **Active loop** — claim top open lettered task; implement; dual-doc; FINISHED; clear claim.

Claim order is **top → bottom**. Earlier phases unblock later money/product work.
Letter IDs are claimable; phase headings are not.

**Related closed work (do not re-do):**

- Backend feature architecture BE-000…044 — Phase 2 complete
- Refactor-Docs 082a (RBAC matrix), 083a (admin wallet credit safety)
- Residual **085a** is absorbed here as **PH-020** (weight contract + UI)

**Excluded by user:** CI, GitHub workflows, deploy automation.

---

## How to read this backlog

| Column | Meaning |
| --- | --- |
| **Maps to** | Prior crawl item (#2–#8) or product UX |
| **Effort** | S ≤½ day · M 1–3 days · L multi-day · XL program |
| **Docs** | Both tracks required unless noted |

Every task ends with:

- [ ] Project docs updated (`apps/backend/docs` and/or `docs/` / FE docs)
- [ ] Obsidian brain updated (domain / architecture / journey / ADR as needed)
- [ ] Local verify (`go build` / scoped tests / FE checks as relevant) — **no CI**

---

# Phase 0 — Documentation operating system (do this first)

Goal: make dual-doc + architecture understanding reliable **before** large code changes.
User asked for excellent architecture docs so they understand how everything works.

### Task Group PH-000 — Dual-doc rules & architecture baseline

- [x] **PH-000a — Dual-doc map & “how to document a change” playbook** · **S** · Maps: process · **DONE 2026-08-11**  
  - See `FINISHED.md`

- [x] **PH-000b — Architecture deep-dive pack (current system, as-built)** · **L** · Maps: #4 docs half · **DONE 2026-08-11**  
  - See `FINISHED.md`

- [x] **PH-000c — Money & stock saga narrative (orders ↔ payments ↔ inventory ↔ wallet)** · **M** · Maps: #4 · **DONE 2026-08-11**  
  - See `FINISHED.md`

- [x] **PH-000d — Future-deferred decisions page (no build)** · **S** · **DONE 2026-08-11**  
  - See `FINISHED.md`

---

# Phase 1 — Correctness & integrity (before more money UX)

Goal: fix lies in code (fake txs), harden money replay, discipline models.  
**#4 is the centerpiece** — treat as production-grade program, not a one-liner middleware wire.

### Task Group PH-010 — Fake transactions (blog / recipe) · Maps: #7

- [x] **PH-010a — Blog/recipe service real atomicity** · **M** · **DONE 2026-08-11**  
  - Blog already had WithTx; recipes fixed + tests. See `FINISHED.md`.

### Task Group PH-011 — Idempotency production-grade · Maps: #4 (PRIMARY FOCUS) · **XL**

Build this as a **stable platform**, not “wire middleware once.”

- [x] **PH-011a — Idempotency design ADR + inventory of money routes** · **M** (docs-first) · **DONE 2026-08-11**  
  - See `FINISHED.md`. Design: `apps/backend/docs/architecture/idempotency.md`

- [x] **PH-011b — Shared store + middleware hardening** · **M** · **DONE 2026-08-11**  
  - See `FINISHED.md`. Scoped keys, 2m stale reclaim, metrics, race/conflict tests.

- [x] **PH-011c — Apply to money routes (orders, wallet, gift-card redeem, …)** · **L** · **DONE 2026-08-11**  
  - See `FINISHED.md`. P0 mounts + double-POST tests; RequireKey stays false until FE.

- [x] **PH-011d — Payment gateway transaction uniqueness** · **S–M** · **DONE 2026-08-11**  
  - See `FINISHED.md`. UNIQUE index + terminal webhook ACK + unit/integration tests.

- [x] **PH-011e — Idempotency runbook + dual-doc completion** · **M** · **DONE 2026-08-11**  
  - See `FINISHED.md`. **PH-011 epic complete.**

### Task Group PH-012 — Models & package discipline · Maps: #6

- [x] **PH-012a — Shared `models` vs feature-local types audit** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`

- [x] **PH-012b — Error mapping consistency (`handleError` / sentinels)** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`

### Task Group PH-012c/d — User-clear errors (backend + frontend) · Maps: product UX / trust

> **Goal:** shoppers and staff must understand *what* failed and *what to do next*.
> Never leave them with only “something went wrong” / generic 500 when the
> domain already knows the reason (stock, coupon, funds, validation, conflict).
> Builds on PH-012b (`httpx.HandleError` + `models.Err*`).

- [x] **PH-012c — Backend: clear, stable error contracts for humans** · **L** · **DONE 2026-08-12**  
  - See `FINISHED.md`. FromAppError funds fix; gift/points/account codes; error-messages.md; mapping tests.

- [x] **PH-012d — Frontend: show real API errors (no generic-only UX)** · **M–L** · **DONE 2026-08-12**  
  - See `FINISHED.md`. `user-facing-error` helper; money paths wired; vitest + tsc green.

### Task Group PH-013 — Background work safety & observability hooks · Maps: #8 (partial)

- [x] **PH-013a — Fire-and-forget goroutine safety** · **S–M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. `pkg/async` + OTP/blog/recipe/orders/password-reset/analytics.

- [x] **PH-013b — Business metrics + saga spans (local-first)** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. orders/payments/inventory/wallet metrics + tracing.Start spans.

- [x] **PH-013c — Test balance on critical pure paths (local)** · **M** · Maps: #8 · **DONE 2026-08-12**  
  - See `FINISHED.md`. JWT/RBAC residual/webhook release tests; TESTING.md + Obsidian.

---

# Phase 2 — Operator trust (admin / inventory / shipping truth)

### Task Group PH-020 — Inventory weight + 085a · Maps: #3

- [x] **PH-020a — Inventory list wire: product weight / missing-weight** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. `weight` + `missing_weight` on InventoryResponse; FE types; dual-doc.

- [x] **PH-020b — Task 085a FE: missing-weight remediation signal** · **S–M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Badge/filter/KPI/detail; Refactor-Docs 085a closed.

- [x] **PH-020c — Checkout shipping weight sum (storefront truth)** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. packageWeightKg + cart weight_kg contract; BE already authoritative.

### Task Group PH-021 — RBAC residual ops · Maps: #2

- [x] **PH-021a — RBAC completeness audit vs admin surfaces** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Read/write capability split; rbac.md matrix; FE docs refresh.

- [x] **PH-021b — Staff/capability UX polish + tests (local)** · **S–M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Last-admin 409; FE messages; playbook mid-session revoke.

---

# Phase 3 — Search quality & Meili readiness · Maps: #5

- [x] **PH-030a — ILIKE search quality (Persian-aware baseline)** · **L** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Normalize + multi-field ILIKE + pg_trgm titles.

- [x] **PH-030b — Meilisearch readiness (index quality, not forced cutover)** · **M–L** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Client + reindex + dual-path design; no storefront cutover.

---

# Phase 4 — Product UX growth (e-commerce, not SaaS streaming)

Order is intentional: **loyalty first** (user priority), then monetization loops that need PH-011.

### Task Group PH-040 — Loyalty triggers & admin (HEAVY FOCUS) · Maps: product UX

- [x] **PH-040a — Loyalty product rules design (docs-first)** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. architecture/loyalty.md + API + Obsidian journeys.

- [x] **PH-040b — Implement earn triggers (backend)** · **L** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Review + birthday + redeem domain key + clawback helper.

- [x] **PH-040c — Storefront loyalty UX** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Rewards ledger/how-to-earn, review toast, order confirm honesty.

- [x] **PH-040d — Admin loyalty rates / tiers UI** · **M–L** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Env-only read-only programme API + `/admin/loyalty` UI.

- [x] **PH-040e — Loyalty analytics hooks (optional but valuable)** · **S–M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Prometheus award/redeem counters + documented analytics event schema.

### Task Group PH-041 — Wallet customer top-up via gateway · Maps: product UX

- [x] **PH-041a — Gateway top-up design + API** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. POST /wallet/topup + Confirm wallet credit; withdraw stays 410.

- [x] **PH-041b — Storefront top-up UX** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Presets + pending intent UI + ledger refresh.

### Task Group PH-042 — Gift card purchase (customer) · Maps: product UX

- [x] **PH-042a — Buy gift card flow (backend)** · **L** · **DONE 2026-08-12**  
  - See `FINISHED.md`. POST /gift-cards/purchase + fulfill on Confirm; staff issue remains.

- [x] **PH-042b — Buy gift card storefront UX** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Purchase + mine self-delivery + redeem polish on `/account/wallet`.

### Task Group PH-043 — Subscriptions as e-com box (not Netflix) · Maps: product UX

- [x] **PH-043a — Box subscription product model clarity** · **M** (docs + small fixes) · **DONE 2026-08-12**  
  - See `FINISHED.md`. box-subscriptions.md + lifecycle `AllowedAction` + dual-doc.

- [x] **PH-043b — Box management UX polish** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. Next-ship copy, confirm dialogs, RTL due email; no contents overbuild.

- [x] **PH-043c — Auto-charge / tokenized pay (only if justified)** · **L** · **DONE 2026-08-12**  
  - **Closed as decision: do not implement.** Email-driven renewal remains product.  
  - Justification: no gateway tokens, no box unit price, no order+stock path from cron.  
  - Docs: `architecture/box-auto-charge-decision.md` + Obsidian ADR; re-open criteria listed.

---

# Phase 5 — Documentation closure gate

- [x] **PH-050a — Dual-doc consistency pass** · **M** · **DONE 2026-08-12**  
  - See `FINISHED.md`. `docs/PH-DUAL-DOC-MATRIX.md` + roadmap/improvements/bridges/MOCs.

- [x] **PH-050b — “Read the system in one hour” outline** · **S** · **DONE 2026-08-12**  
  - See `FINISHED.md`. `docs/READ-THE-SYSTEM.md` + Project Brain + docs README.

---

# Phase 6 — Modular checkout gift options (founder request 2026-08-12)

> Checkout already has basic “is gift / message / free wrap checkbox”.  
> **Goal:** admin-configurable modular gift add-ons (packaging, card, extras)
> with **server-priced** fees, snapshot on the order, dual-doc.

- [x] **PH-060a — Gift checkout settings (modular options)** · **M**  
  - Site settings group `gift` (JSONB, no multi-currency/warehouse):  
    `enabled`, `messageEnabled`, `messageMaxLength`, `hidePriceEnabled`,  
    `options[]` = `{ id, label, description, price, enabled, sortOrder }`  
  - Public GET /settings exposes gift config; admin PUT can replace the group  
  - Defaults when missing: gift enabled + one “gift_wrap” option at price 0  
  - Dual-doc: site-settings API + architecture note  
  - Tests for Apply/ToPublic defaults  

- [x] **PH-060b — Order charges selected gift options** · **M–L**  
  - CreateOrder accepts `gift_option_ids[]` (when `is_gift`)  
  - Server resolves against **current** admin options; reject unknown/disabled  
  - Persist snapshot + `gift_addons_fee`; include in generated `total_amount`  
  - Keep `gift_wrap` for backward compat (map selected wrap option → true)  
  - Dual-doc orders API; unit tests for fee math / invalid option  

- [x] **PH-060c — Checkout FE modular gift UI + summary fee** · **M**  
  - Load public gift settings; hide section if disabled  
  - Multi-select add-ons with prices; message/hide-price respect flags  
  - Summary line for gift fees; place order sends option ids  
  - Vitest + tsc  

- [x] **PH-060d — Admin settings UI for gift options** · **M**  
  - Settings tab “هدیه”: enable flags + editable option list (JSON options + flags)  
  - Persist via existing settings PUT  

---

# Claim order (execution sequence)

Execute **only after user approval**. Suggested strict order:

### Phase 0
1. PH-000a → 000b → 000c → 000d  

### Phase 1
2. PH-010a  
3. PH-011a → 011b → 011c → 011d → 011e   ← **deep focus**  
4. PH-012a → 012b → **012c (clear BE errors)** → **012d (clear FE errors)**  
5. PH-013a → 013b → 013c  

### Phase 2
6. PH-020a → 020b → 020c  
7. PH-021a → 021b  

### Phase 3
8. PH-030a → 030b  

### Phase 4 (growth)
9. PH-040a → 040b → 040c → 040d → (040e optional)   ← **loyalty heavy**  
10. PH-041a → 041b  
11. PH-042a → 042b  
12. PH-043a → 043b → (043c only if approved)  

### Phase 5
13. PH-050a → 050b  

### Phase 6 (founder 2026-08-12)
14. **PH-060a → 060b → 060c → 060d** — modular buy-as-gift  

---

# Mapping: prior crawl → this backlog

| Prior # | Theme | Tasks |
| --- | --- | --- |
| ~~1 CI~~ | Out of scope (user: no server) | — |
| **2** | RBAC complete ops | PH-021* |
| **3** | 085a inventory weight | PH-020* |
| **4** | Idempotency + architecture docs | PH-000*, PH-011* (primary), PH-000b/c |
| **5** | Search / Meili readiness | PH-030* |
| **6** | Models discipline | PH-012* |
| **7** | Fake blog/recipe txs | PH-010a |
| **8** | Background safety, metrics/spans, test balance | PH-013* |
| Product | Loyalty triggers (priority) | PH-040* |
| Product | Gift card purchase | PH-042* |
| Product | Gateway wallet top-up | PH-041* |
| Product | Box subscription (not Netflix) | PH-043* |
| Dual docs | Project + Obsidian brain | Every task + PH-000 / PH-050 |
| Deferred | Multi-currency, multi-warehouse, crypto, CI | PH-000d only |

---

# Explicit non-goals checklist

- [x] No CI/workflows in this program  
- [x] No multi-currency  
- [x] No multi-warehouse  
- [x] No crypto rails now (maybe later — recorded)  
- [x] No Netflix-style subscription product  

---

When implementing later: one lettered task in `IN_PROGRESS.md`, finish to `FINISHED.md`, clear claim.  
**This file is the source of order until user re-prioritizes.**
