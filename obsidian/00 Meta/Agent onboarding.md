---
tags:
  - meta
  - agents
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 00 Meta]]


# Agent onboarding

For AI agents and new humans dropping into Rumera mid-task.

## Read order (30 min)

1. [[How to use this vault]] · [[00 Home]] · [[System Atlas]]
2. If you will write notes: [[How to add a note]] · [[Vault conventions]]
3. [[Project Structure]] · [[Request Paths]]
4. [[Wire contracts]] · [[Money and stock rules]]
5. Domain of your task from [[Business Domains MOC]]
6. Bridge to long docs: [[Documentation Bridge]]
7. Pitfalls: [[Pitfalls and anti-patterns]] · gaps: [[Known gaps]]

## Hard rules

- Frontend types match **Go JSON tags**, not Go field names → [[Wire contracts]]
- Stock sellable = **available**, not on-hand → [[Inventory]] · [[Money and stock rules]]
- Browser never holds access token → [[BFF Proxies]] · [[Auth and Sessions]]
- Order+reserve atomic; pay+deduct atomic → [[Orders]] · [[Payments]]
- Thin routes; logic in `features/*` / services → [[Frontend Domain Map]] · [[Layered Backend]]
- Don’t invent Meili search as live — still ILIKE → [[Search Backend]]
- Parallel Task 062 owns Playwright — don’t collide e2e files

## Verification

[[Testing]] · `docs/TESTING.md` via [[Docs Bridge Root]]

## Related

[[Vault conventions]] · [[Playbooks MOC]] · [[Map of Content]]

#meta #agents
