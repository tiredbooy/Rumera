---
tags:
  - brain
  - hub
  - center
aliases:
  - Brain
  - The Brain
  - Rumera Brain
cssclasses:
  - wide
---

# Project Brain

**This is the center of the vault.** Every area folder has a **Connect** note that
links here. Open **Graph view** on this note (local graph) to see all folders
radiating out like a synapse.

```text
                    [[Connect 00 Meta]]
                           │
[[Connect 08 Glossary]] ───┤
[[Connect 09 Journeys]] ───┼─── [[Project Brain]] ───┬─── [[Connect 01 Maps]]
[[Connect 10 Code Maps]] ──┤                         ├─── [[Connect 02 Architecture]]
[[Connect 11 Decisions]] ──┤                         ├─── [[Connect 03 Backend]]
[[Connect 12 Playbooks]] ──┤                         ├─── [[Connect 04 Frontend]]
[[Connect 13 Surfaces]] ───┘                         ├─── [[Connect 05 Domains]]
                                                     ├─── [[Connect 06 Ops]]
                                                     └─── [[Connect 07 Docs Bridge]]
```

---

## Start here

| Need | Open |
|------|------|
| How to use | [[How to use this vault]] |
| How to add notes | [[How to add a note]] |
| Full index | [[Map of Content]] |
| System diagram | [[System Atlas]] |
| What’s missing | [[Known gaps]] |
| Long repo docs | [[Documentation Bridge]] |

---

## All folder connectors (always keep linked)

- [[Connect 00 Meta]] — usage, conventions, templates, home
- [[Connect 01 Maps]] — MOCs, atlas, gaps
- [[Connect 02 Architecture]] — cross-cutting design
- [[Connect 03 Backend]] — Go API ownership
- [[Connect 04 Frontend]] — Next.js ownership
- [[Connect 05 Domains]] — business language
- [[Connect 06 Ops]] — run, test, env, migrate
- [[Connect 07 Docs Bridge]] — manuals outside the vault
- [[Connect 08 Glossary]] — terms
- [[Connect 09 Journeys]] — end-to-end stories
- [[Connect 10 Code Maps]] — package / feature trees
- [[Connect 11 Decisions]] — ADRs
- [[Connect 12 Playbooks]] — debug & how-to
- [[Connect 13 Surfaces]] — URL surfaces

---

## Critical systems (direct synapses)

[[Frontend App]] · [[Backend API]] · [[BFF Proxies]] · [[Data Stores]]  
[[Catalogue]] · [[Cart and Checkout]] · [[Orders]] · [[Inventory]] · [[Payments]]  
[[Auth and Sessions]] · [[RBAC]] · [[Media Pipeline]] · [[Notifications]] · [[Search]]  
[[Account Domain]] · [[Admin Console]] · [[Money and stock rules]] · [[Wire contracts]]

## Money path

[[Cart and Checkout]] → [[Orders]] → reserve [[Inventory]] → [[Payments]] webhook → deduct · loyalty

---

## Rule for new notes

1. Follow [[How to add a note]].
2. Put the note in the right numbered folder.
3. Ensure the matching **Connect …** note links it (or its MOC).
4. That folder already links to **this** note — so the brain stays one graph.

## Related

[[00 Home]] · [[Map of Content]] · [[System Atlas]] · [[Business Domains MOC]] · [[Agent onboarding]]

#brain #hub #center
