# Box subscriptions (cellar box) — product model

**As-built · PH-043a**  
**Package:** `internal/features/subscription`  
**API:** [api/subscriptions.md](../api/subscriptions.md)  
**Cron:** `internal/corn/subscription_renewal_job.go` (see [processes-and-jobs.md](./processes-and-jobs.md))

This document is the **source of truth** for what a Rumera “subscription” is.
It is an **e-commerce recurring physical box**, not a streaming or SaaS plan.

---

## One-sentence product definition

A customer opts into **باکس سرداب** (`plan = cellar-box`): on a chosen **cadence**,
the shop intends to ship a **curated physical selection** of goods to a delivery
address; the customer can **pause**, **skip one period**, **cancel**, or **resume**.

---

## What it is

| Concept | Meaning in Rumera |
|---------|-------------------|
| **Plan** | Fixed string `cellar-box` only (constant `PlanCellarBox`). No multi-plan catalogue of digital SKUs. |
| **Cadence** | `monthly` (+1 calendar month) or `quarterly` (+3 calendar months) via `NextRenewal`. |
| **Status** | `active` · `paused` · `cancelled` |
| **Next renewal** | `next_renewal_at` — when the system considers the **next box window** due. |
| **Address** | Optional `address_id` → customer address book. Omitted/null is allowed on create; ship-to may be incomplete until set. |
| **Contents** | **Not a per-subscription SKU list today.** “Contents” means the **merchant-curated physical assortment** for that box cycle (ops/fulfilment concern). There is no `items[]`, preference JSON, or entitlement grant in the API model. |

### Lifecycle actions (`PATCH /subscriptions/:id`)

| Action | Allowed from | Effect |
|--------|----------------|--------|
| `pause` | `active` | → `paused`; due job ignores the row |
| `resume` | `paused` or `cancelled` | → `active` (reactivate) |
| `cancel` | `active` or `paused` | → `cancelled` |
| `skip` | `active` | Push `next_renewal_at` by one cadence; **no payment** |

Invalid transitions return `INVALID_REQUEST` (`AllowedAction` in `model.go`).

### Renewal job (as-built · PH-043b email)

1. Find rows: `status = active` AND `next_renewal_at <= now` (limit 500 per tick).
2. Email the customer a **Persian RTL** HTML message (subject «باکس سرداب شما آماده است»)
   built by `buildRenewalEmailHTML` in `internal/corn/subscription_renewal_email.go`:
   - `lang="fa"` · `dir="rtl"`
   - States this is a **reminder**, not an automatic charge
   - CTA → `/account/subscriptions` (pause / skip / cancel)
3. Advance `next_renewal_at` by one cadence **even if the email fails** (email
   failure is logged; date still rolls so the job does not hammer the same rows).

**Charging is intentionally not implemented** in this job. There is no tokenized
card on file, no order creation, and no wallet debit for box renewals today.

### Storefront UX (PH-043b)

Account `/account/subscriptions`:

- Labels next window as **ارسال باکس بعدی** (not “invoice”)
- Confirm dialogs for pause, skip, and cancel with effect copy
- Optional ship-to address on create; missing-address callout on active cards
- No contents preference UI (field not on the API)

---

## What it is **not** (explicit non-goals)

Do **not** design or document Rumera subscriptions as:

| Non-goal | Why |
|----------|-----|
| **Unlimited catalogue access** | Shoppers buy products (or receive a physical box); they do not unlock the whole store by subscribing. |
| **Streaming / digital entitlements** | No media library, no “watch forever while subscribed.” |
| **Seat-based SaaS billing** | No org seats, no per-user license tiers. |
| **Netflix-style always-on auto-bill** | **Declined for this program (PH-043c closed).** Email-driven renewal reminder only — see [box-auto-charge-decision.md](./box-auto-charge-decision.md). |
| **Multi-currency subscription plans** | Single currency (IRT/Toman) for the commerce stack. |

If a proposal uses words like “entitlement”, “seat”, “stream”, or “unlimited
access”, it is **out of product scope** for this domain.

---

## Money & inventory relationship

| Concern | Today | Notes |
|---------|--------|--------|
| Subscribe create | Free row create | No charge at `POST /subscriptions` |
| Renewal | Email + date roll | No order, payment, or stock reservation |
| Fulfilment | Ops-driven | Box contents are not automated from this table |
| Idempotency | Create is P1 money-adjacent | Catalogue in [idempotency.md](./idempotency.md); lifecycle actions rely on domain guards |

**Auto-charge decision (PH-043c):** closed — **will not implement** until
re-open criteria in [box-auto-charge-decision.md](./box-auto-charge-decision.md)
are met (gateway tokens, box price, order+stock path, opt-in, idempotency).

---

## Surfaces

| Surface | Path / package |
|---------|----------------|
| Customer API | `GET/POST /subscriptions`, `PATCH /subscriptions/:id` |
| Feature slice | `internal/features/subscription` |
| Cron | `subscription_renewal` job name in bootstrap |
| Storefront | `/account/subscriptions` · `apps/frontend/features/subscriptions` |
| Admin API | **None** today (`RegisterAdmin` empty) |

---

## Schema (main Postgres)

Table `subscriptions` (migration `20260615190000_create_subscriptions.sql`):

- `plan` default `cellar-box`
- `cadence` check `monthly|quarterly`
- `status` check `active|paused|cancelled`
- `address_id` nullable FK → `addresses`
- partial index on `next_renewal_at` where `status = 'active'`

---

## Related docs

- [api/subscriptions.md](../api/subscriptions.md) — request/response contracts  
- [processes-and-jobs.md](./processes-and-jobs.md) — cron inventory  
- [idempotency.md](./idempotency.md) — create subscription key catalogue  
- monorepo [FEATURE-ROADMAP.md](../../../../docs/FEATURE-ROADMAP.md) — known follow-ups  
- Dual-doc: Obsidian `05 Domains/Subscriptions`, `09 Journeys/Journey Subscription *`

---

## Residual / next

- **PH-043a–c done** — product model, UX, auto-charge **decision closed** (email-only)  
- Optional contents preference model — only if product asks; do not invent fields  
- Bound `ListByUser` with a LIMIT (improvement backlog)
- Change ship-to address on an existing subscription (API has no PATCH address today)
