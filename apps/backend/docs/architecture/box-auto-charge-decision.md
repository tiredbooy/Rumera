# PH-043c — Box auto-charge / tokenized pay (decision)

**Status:** **Closed — will not implement now**  
**Date:** 2026-08-12  
**Product model:** [box-subscriptions.md](./box-subscriptions.md)  
**Idempotency:** [idempotency.md](./idempotency.md) (PH-011)

This note closes the gated task **PH-043c**. It is a **product/architecture
decision**, not a half-built payment rail.

---

## Decision

**Keep email-driven renewal only.** The renewal cron continues to:

1. Find due active cellar-box subscriptions  
2. Email a Persian RTL reminder (not a charge receipt)  
3. Advance `next_renewal_at` by one cadence  

**Do not** add tokenized card-on-file, automatic gateway charge, wallet silent
debit, or order auto-create for box renewals in this program.

---

## Why (justification)

| Prerequisite for safe auto-charge | As-built today |
|-----------------------------------|----------------|
| Gateway **stored payment credential** / token product | **None** — payments are one-shot pending txs + webhooks (orders, wallet top-up, gift purchase) |
| Stable **box unit price** (SKU / plan price) | **None** — subscribe create is free; contents are ops-curated, not priced on the sub row |
| Real **order + stock** path for a box shipment | **None** — fulfilment is ops-driven; no order from renewal job |
| Customer **opt-in** to auto-bill (not Netflix surprise) | Would need new consent UX + legal copy |
| **Idempotent** money path (PH-011) | Platform exists, but no charge surface to attach yet |

Building “auto-charge” without the above would invent free-money risk, fake
tokens, or silent debits — out of charter for production hardening.

The original backlog default was correct: *keep email-driven renewal until
gateway tokens exist; do not force Netflix-style always-on billing.*

Founder go-ahead for this task is interpreted as **permission to close the gate
with a permanent decision for this program**, not as “ship card tokens now.”

---

## What remains the product

- **باکس سرداب** = recurring physical box intent + pause / skip / cancel / resume  
- Money for goods stays on normal checkout (cart → order → pay)  
- Renewal email: “box window is due — manage subscription” (no automatic charge language that implies a capture)

---

## Re-open criteria (future program only)

A new lettered task may re-open auto-charge **only when all** of the following
exist:

1. Payment provider supports **stored credentials** (or wallet opt-in debit with
   explicit balance rules and failure handling)  
2. Documented **box price** (or catalogue SKU) and tax rules  
3. Design for **order create + inventory** (or explicit ops handoff) on success  
4. Customer **opt-in** default-off; pause/cancel still stop charges  
5. Idempotency keys scoped per renewal period (no double charge)  
6. Dual-doc ADR + dual-track journeys before code  

Until then, treat auto-charge as **explicitly deferred product**, not residual
engineering debt.

---

## Code touchpoints (unchanged behaviour)

| Path | Role |
|------|------|
| `internal/corn/subscription_renewal_job.go` | Email + advance only |
| `internal/features/subscription/` | Lifecycle API; no charge fields |
| `migrations/main/20260615190000_create_subscriptions.sql` | No payment token columns |

---

## Related

- Dual-doc: Obsidian `11 Decisions/ADR Box auto-charge declined.md`  
- Roadmap: monorepo `docs/FEATURE-ROADMAP.md` (moved off “gated task” list)
