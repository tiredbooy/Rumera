---
tags:
  - hub
  - brain
  - entry
aliases:
  - Home
  - Rumera Home
cssclasses:
  - wide
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 00 Meta]]


# Rumera — vault home

> **Center of the graph:** [[Project Brain]] (folder `Brain/`).  
> This home page is orientation only; all folders hang off the brain via **Connect** notes.

> Working memory of the monorepo: linked concepts, code maps, journeys, decisions,
> and bridges to long-form docs. Use the **Graph** on [[Project Brain]] to see synapses.

**Stack:** Go API · Next.js 16 storefront/admin · Postgres · Timescale · Redis · (optional Kafka)

## 60-second orientation

| I need… | Open |
|---------|------|
| **Center of the graph** | [[Project Brain]] |
| **How to use the vault** | [[How to use this vault]] |
| **How to add a note (format)** | [[How to add a note]] |
| Rules / conventions | [[Vault conventions]] |
| What’s still missing | [[Known gaps]] |
| Full index | [[Map of Content]] |
| One diagram of the system | [[System Atlas]] |
| Business domains | [[Business Domains MOC]] |
| User journeys | [[Journeys MOC]] |
| Where code lives | [[Code Maps MOC]] · [[Project Structure]] |
| Why we chose X | [[Decisions MOC]] |
| How to fix a bug | [[Playbooks MOC]] |
| Definitions | [[Glossary]] |
| Long markdown guides | [[Documentation Bridge]] |

## Major systems (graph anchors)

```text
[[Frontend App]] ──[[BFF Proxies]]──► [[Backend API]] ──► [[Data Stores]]
       │                                    │
       ├── [[Catalogue]] · [[Search]]       ├── [[Inventory]]
       ├── [[Cart and Checkout]]            ├── [[Payments]]
       ├── [[Account Domain]]               ├── [[Notifications]]
       └── [[Admin Console]]                └── [[Media Pipeline]]
```

## Critical money path

[[Cart and Checkout]] → [[Orders]] → **reserve** [[Inventory]] → pending [[Payments]] → webhook **confirm** → **deduct** stock · loyalty

Deep: [[Inventory Backend]] · [[Payments Backend]] · [[Playbook Debug Oversell]] · [[Playbook Debug Webhook]]

## How to grow the brain

Full procedure: **[[How to add a note]]**. Short version:

1. Pick note **type** → correct folder + title pattern.
2. Use a **template** when available (`00 Meta/templates/`).
3. Link ≥2 existing notes; update the right **MOC**.
4. Prefer real wikilinks; no orphan notes.
5. Check [[Known gaps]] before inventing a parallel topic.

## Related meta

- [[How to use this vault]] · [[How to add a note]] · [[Vault conventions]]
- [[Agent onboarding]] · [[Known gaps]]
- Repo: `../README.md` · Docs hub: `../docs/README.md`

#hub #brain #entry
