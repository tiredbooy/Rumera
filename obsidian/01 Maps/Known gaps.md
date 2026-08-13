---
tags:
  - moc
  - meta
  - gaps
aliases:
  - Missing notes
  - Vault gaps
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 01 Maps]]


# Known gaps

Living list. Prefer fixing items here over random notes. Procedure: [[How to add a note]].

---

## Recently filled (keep for history)

- Product alerts domain + BE + journey  
- Subscriptions domain + BE + renewal journey (no auto-charge)  
- Referrals as own domain + BE + paid-order journey  
- Image uploader FE detail  
- Admin analytics FE  
- Age gate expanded  
- Wishlist stock playbook · admin refund restock journey  
- Env encyclopedia expansion · migration runbook  
- Incident playbook · security baseline ADR · performance/CWV note  
- CI/CD current-state note · Playwright status under [[Testing]]  
- Gateway/nginx · Makefile map (earlier)

---

## Still thin / future

| Gap | Notes |
|-----|--------|
| **Production hardening program** | **Lettered backlog complete** (PH-000…060). Matrix: `docs/PH-DUAL-DOC-MATRIX.md`. Tour: `docs/READ-THE-SYSTEM.md`. PH-043c closed (no auto-charge). |
| **Models ownership** | **PH-012a complete** — feature-local domain types; `internal/models` shared-only + package doc. |
| **Error mapping** | **PH-012b complete** — feature handlers use `httpx.HandleError`. |
| **User-clear errors** | **PH-012c/d complete** — BE codes + FE `user-facing-error` on money paths. Residual: NextAuth login code passthrough. |
| **Fire-and-forget safety** | **PH-013a complete** — `pkg/async` recover + GoCtx; OTP/email/counters/analytics wired. |
| **Loyalty earn triggers** | **PH-040a–e done** (rules, BE, FE UX, admin rates, Prometheus hooks + event schema). Residual: analytics DB insert, refund clawback wire, admin adjust API. |
| **Idempotency platform** | **PH-011 complete** (scoped keys, mounts, UNIQUE tx id, terminal ACK, runbook + API dual-doc). Residual: loyalty **spend** domain event key (PH-040); FE `RequireKey` flip when storefront always sends keys. |
| **Architecture deep-dive refresh** | Feature-slice architecture must land in vault + `apps/backend/docs` (PH-000) |
| **Subscription charging** | **PH-043a–c done.** Cron emails only; auto-charge **declined** ([[ADR Box auto-charge declined]]). Residual: change address on existing sub; list LIMIT. |
| **Gift card purchase** | **PH-042a–b done** (API + storefront purchase/mine/redeem). Residual: email code delivery, gateway redirect URL. |
| **Gateway wallet top-up** | **PH-041a–b done** (API + storefront presets/pending). Real gateway redirect URL optional later. |
| **Inventory / checkout weight** | **PH-020a–c done** (admin wire + FE signal + checkout package weight sum). Residual: products still missing kg need staff fix. |
| **Search quality / Meili** | **PH-030a–b done** — ILIKE Persian baseline + Meili client/reindex readiness. **Cutover** still deferred (dual-path checklist in search.md). |
| **Unified alert email via Kafka Dispatcher** | Alerts still use cron mailer path |
| **Full STRIDE threat model** | Baseline only in [[ADR Security posture baseline]] |
| **Numeric CWV budgets** | Intent captured in [[Performance and CWV]] — no lab SLOs yet |
| **Playwright command runbook** | Blocked on Task 062 suite landing |
| **RMA/return state machine** | Only manual inventory `refund` adjust |
| **Multi-warehouse** | Deferred — not now |
| **Multi-currency** | Deferred — Toman only for now |
| **Crypto payments** | Maybe later — not now |

## Intentionally out of scope

- Full API field catalogs (use `apps/backend/docs/api/`)
- CI / deploy workflows until there is a server (founder decision 2026-08-11)
- Netflix-style digital subscriptions
- Multi-currency / multi-warehouse / crypto (for now)
- Dataview/Canvas as primary UX (Graph is enough)
- Treating refactor task trackers as product notes (except this program’s charter is linked from gaps for agents)

---

## Related

[[How to add a note]] · [[Map of Content]] · [[00 Home]] · [[Agent onboarding]]

#gaps #meta
