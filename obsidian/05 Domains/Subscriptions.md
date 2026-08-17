---
tags: [domain]
aliases:
  - Cellar box
  - Box subscription
  - باکس سرداب
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Subscriptions (cellar box)

## Product definition (one sentence)

Recurring **physical curated box** (“باکس سرداب” / plan `cellar-box`): cadence-driven
ship intent + customer lifecycle controls. **Not** Netflix-style unlimited digital
access, streaming entitlements, or seat-based SaaS.

## Fields (as-built)

| Field | Values |
|-------|--------|
| Plan | fixed `cellar-box` only (`PlanCellarBox`) |
| Cadence | `monthly` · `quarterly` |
| Status | `active` · `paused` · `cancelled` — **one `active` cellar-box per customer** (PR-057b) |
| Actions | `pause` · `resume` · `cancel` · `skip` |
| Address | optional `address_id` (create + `PATCH`; must be caller-owned) |
| Next window | `next_renewal_at` |

### Lifecycle matrix

| Action | From | Effect |
|--------|------|--------|
| pause | active | → paused |
| resume | paused / cancelled | → active. `CONFLICT` if another row is already active |
| cancel | active / paused | → cancelled |
| skip | active | push `next_renewal_at` by one cadence |

Invalid transitions → `INVALID_REQUEST`.

One active box (PR-057b): `POST /subscriptions` while the caller already has
`status=active` → `CONFLICT` (409). Paused / cancelled do not occupy the
slot; a second create is allowed then. Resume of a paused/cancelled row
while another is active is also `CONFLICT`.

`PATCH /subscriptions/:id` also accepts `address_id` (≥ 1) **without** a
lifecycle action (PR-005c). Combined bodies apply action then ship-to. No
charge. Address-book ownership is enforced on **create and PATCH** via
[[Addresses Backend]] `GetByID(id, userID)` (same as checkout). Missing /
other-user → `NOT_FOUND`.
Storefront picker (PR-035b) is on [[Account FE]] / [[Journey Manage cellar box]].

## What “contents” means

Merchant-curated **physical** assortment for a box cycle. **Not** modeled as a
per-subscription SKU list, preference JSON, or digital entitlement in the API today.
Do not invent `items[]` without a product decision.

## Renewal (truth)

Cron (`subscription_renewal_job` → `subscription.ProcessDueRenewals`):

1. Due active rows  
2. Persian “box ready” email + link to `/account/subscriptions`  
3. Advance `next_renewal_at` **only after dispatch/send succeeds** (PR-057a /
   PR-055a). Prefers [[Notifications]] dispatcher (period-scoped outbox key);
   inline mailer is the fallback. Both unset or send failure leaves the row due.

**No auto-charge** (PH-043c **closed** — [[ADR Box auto-charge declined]]).  
No order creation. No inventory reservation from this table.  
Email-driven renewal only until a future program meets re-open criteria.

## Explicit non-goals

- Unlimited catalogue unlock  
- Streaming / media library access  
- Seat-based SaaS billing  
- Always-on Netflix-style billing as the default product  

## Surfaces

- Account: `/account/subscriptions` → [[Account FE]]
- API: `GET/POST /subscriptions`, `PATCH /subscriptions/:id`
- Docs: `apps/backend/docs/architecture/box-subscriptions.md` · `api/subscriptions.md`

## Code map

| Layer | Path |
|-------|------|
| Feature slice | `apps/backend/internal/features/subscription/` |
| Cron | `apps/backend/internal/corn/subscription_renewal_job.go` |
| FE | `apps/frontend/features/subscriptions/` |

## Related

[[Subscriptions Backend]] · [[Account Domain]] · [[Orders]] · [[Payments]] ·
[[Journey Subscription renewal email]] · [[Journey Manage cellar box]] ·
[[Business Domains MOC]] · [[ADR Deferred product and platform]] · [[Known gaps]]

#domain
