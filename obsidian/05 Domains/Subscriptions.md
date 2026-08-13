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
| Status | `active` · `paused` · `cancelled` |
| Actions | `pause` · `resume` · `cancel` · `skip` |
| Address | optional `address_id` |
| Next window | `next_renewal_at` |

### Lifecycle matrix

| Action | From | Effect |
|--------|------|--------|
| pause | active | → paused |
| resume | paused / cancelled | → active |
| cancel | active / paused | → cancelled |
| skip | active | push `next_renewal_at` by one cadence |

Invalid transitions → `INVALID_REQUEST`.

## What “contents” means

Merchant-curated **physical** assortment for a box cycle. **Not** modeled as a
per-subscription SKU list, preference JSON, or digital entitlement in the API today.
Do not invent `items[]` without a product decision.

## Renewal (truth)

Cron (`subscription_renewal_job`):

1. Due active rows  
2. Persian “box ready” email + link to `/account/subscriptions`  
3. Advance `next_renewal_at` (even if email fails)

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
