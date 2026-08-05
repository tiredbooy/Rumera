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
| **Subscription charging** | Product not built; cron only emails — don’t invent notes as if live |
| **Unified alert email via Kafka Dispatcher** | Alerts still use cron mailer path |
| **Full STRIDE threat model** | Baseline only in [[ADR Security posture baseline]] |
| **Numeric CWV budgets** | Intent captured in [[Performance and CWV]] — no lab SLOs yet |
| **Playwright command runbook** | Blocked on Task 062 suite landing |
| **Automated vault link checker in CI** | Nice-to-have |
| **RMA/return state machine** | Only manual inventory `refund` adjust |
| **Multi-warehouse** | Not a product feature |

## Intentionally out of scope

- Full API field catalogs (use `apps/backend/docs/api/`)
- Refactor task trackers as product notes
- Dataview/Canvas as primary UX (Graph is enough)

---

## Related

[[How to add a note]] · [[Map of Content]] · [[00 Home]] · [[Agent onboarding]]

#gaps #meta
