---
tags: [adr, subscriptions, payments]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Box auto-charge declined (PH-043c)

## Status

**Accepted** — 2026-08-12. Closes workstream task PH-043c.

## Context

Cellar box renewals email the customer and roll `next_renewal_at`. Auto-charge /
tokenized pay was gated as PH-043c (“only if justified”).

As-built stack has no gateway stored credentials, no box unit price on the
subscription row, and no order+stock path from the renewal job.

## Decision

**Do not implement** automatic charging for box renewals in this program.
Keep **email-driven** renewal. Re-open only when prerequisites in project doc
`apps/backend/docs/architecture/box-auto-charge-decision.md` are met.

## Consequences

- No surprise Netflix-style billing  
- Ops still owns box fulfilment  
- Customers manage via `/account/subscriptions` after the reminder email  
- Future auto-charge is a **new** product task, not residual debt  

## Related

[[Subscriptions]] · [[Journey Subscription renewal email]] · [[Payments Backend]] · project `box-auto-charge-decision.md`
