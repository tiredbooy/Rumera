---
tags:
  - playbook
  - docs
  - required-reading
aliases:
  - Document a change
  - Dual-track docs playbook
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook Document a change

Use this **every time** you ship a behavioural or architectural change.
Canonical long form: repo `docs/DOCUMENTATION-DUAL-TRACK.md`.

---

## Two tracks

| Track | Where | Job |
|-------|--------|-----|
| Project docs | `docs/`, `apps/backend/docs/`, `apps/frontend/docs/` | Depth, API, procedures |
| This vault | notes + Graph | Map, ownership, journeys, ADRs |

**Both required.** Depth without Graph = tribal maps die. Graph without depth = pretty emptiness.

---

## Quick procedure

1. **Classify** the change: money · inventory · auth/RBAC · search · endpoint · admin · UX-only · deferred.
2. **Update project docs** first if contracts or sequences changed (API + architecture).
3. **Touch vault:**
   - Domain note(s) under `05 Domains`
   - Ownership note (`03 Backend` / `04 Frontend`) if code home moved
   - **Journey** if a customer or operator path changed
   - **ADR** if policy/boundary is sticky (see dual-track §3)
   - Bridge under `07 Docs Bridge` if a new hub file appeared
4. **Known gaps** — close or add rows in [[Known gaps]].
5. **Link** ≥2 real wikilinks + keep Brain Connect lists honest when adding notes.
6. Record paths in the workstream `FINISHED.md`.

---

## Hard rule: money / auth / inventory

Any change that touches **money, auth/sessions/RBAC, or stock** must include:

1. Project architecture and/or API doc update  
2. Domain note touch  
3. Journey create-or-update when the live path changed  

Examples:

- Checkout reserve/pay → [[Journey First purchase]] · [[Cart and Checkout]] · [[Orders]] · [[Payments]] · [[Money and stock rules]]
- Webhook settle → [[Journey Payment webhook settle]] · [[Playbook Debug Webhook]]
- Admin credit wallet → [[Journey Account wallet redeem]] or admin journey · [[Wallet Backend]] · [[Loyalty Wallet Gift Cards]]
- Stock adjust / oversell risk → [[Playbook Debug Oversell]] · [[Inventory]]

---

## When to write an ADR

- Ledger, stock, or payment policy changes  
- Auth/RBAC model changes  
- Search strategy (ILIKE vs Meili)  
- Explicit **non-goals** (multi-currency, multi-warehouse, crypto later, no CI until server, box-not-Netflix subs)  
- New cross-feature ownership boundary  

Template: `00 Meta/templates/Decision.md` → folder `11 Decisions/` titled `ADR …`.

---

## What not to do

- Paste full OpenAPI tables into vault notes — link [[Documentation Bridge]] instead  
- Update only `FINISHED.md` and skip product docs  
- Invent CI workflow docs as a substitute for dual-track (CI is out of scope until there is a server)  
- Create duplicate domain notes with new names — edit the existing title  

---

## Related

[[Vault conventions]] · [[How to add a note]] · [[Documentation Bridge]] · [[Docs Bridge Root]] · [[Known gaps]] · [[Playbook Add backend endpoint]] · [[Playbook Add admin module]] · [[Money and stock rules]]

#playbook #docs
