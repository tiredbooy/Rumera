---
tags:
  - meta
  - brain
  - required-reading
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 00 Meta]]


# Vault conventions

Hard rules for the project brain. **How to** steps live in [[How to add a note]]
and [[How to use this vault]].

---

## Purpose

- Make the **Graph** a useful map of Rumera (not a second random wiki).
- **[[Project Brain]]** is the single center: every numbered folder has a
  `Brain/Connect …` note that links here and lists its notes.
- Keep notes **short, linked, and typed**.
- Keep **canonical depth** in repo docs; vault points at them.

## Dual-track documentation (required)

Rumera uses **two tracks**. Material changes update **both**.

| Track | Location | Job |
|-------|----------|-----|
| Project docs | `docs/`, `apps/*/docs/` | Procedures, API contracts, architecture depth |
| This vault | `obsidian/` | Graph, journeys, ADRs, ownership, mental models |

Canonical process (repo): `docs/DOCUMENTATION-DUAL-TRACK.md`  
Vault playbook: [[Playbook Document a change]]  
Bridge hub: [[Documentation Bridge]]

### Hard rule — money / auth / inventory

Any change that touches money, auth/sessions/RBAC, or stock must:

1. Update project architecture and/or API docs  
2. Touch the domain note(s)  
3. Create or update a **journey** when the live path changed  

### When to write an ADR

Sticky policy or boundary (money/stock, auth, search strategy, explicit non-goals,
new cross-feature ownership) → `11 Decisions/ADR …` and link constrained domains.
See dual-track doc §3.

### Definition of done (docs half of any task)

- Project paths updated  
- Vault notes updated (no broken wikilinks)  
- Bridge / [[Known gaps]] adjusted when relevant  
- Workstream `FINISHED.md` lists both tracks

---

## Note types (summary)

| Type | Folder | Naming |
|------|--------|--------|
| **Graph center** | `Brain/` | [[Project Brain]] + `Connect NN …` only |
| Hub / MOC | `01 Maps` | `… MOC` / Atlas |
| Meta / guide | `00 Meta` | Clear titles |
| Architecture | `02 Architecture` | System-level |
| Backend | `03 Backend` | `… Backend` |
| Frontend | `04 Frontend` | `… FE` |
| Domain | `05 Domains` | Business name |
| Ops | `06 Ops` | Ops topic |
| Docs bridge | `07 Docs Bridge` | `Docs Bridge …` |
| Glossary | `08 Glossary` | `Term …` |
| Journey | `09 Journeys` | `Journey …` |
| Code map | `10 Code Maps` | `… map` |
| Decision | `11 Decisions` | `ADR …` |
| Playbook | `12 Playbooks` | `Playbook …` |
| Surface | `13 Surfaces` | `Surface …` |

Full create checklist → [[How to add a note]].

---

## Linking rules

1. Prefer real wikilinks to existing note titles over prose-only mentions of a concept that has a note.
2. Every non-template note has a **Related** section with ≥2 wikilinks (hubs may have many).
3. Domain notes link BE + FE ownership notes when both exist.
4. Playbooks/journeys link domains they touch.
5. Decisions link the systems they constrain.
6. Never leave broken wikilinks (create stub or fix spelling).
7. After rename: use Obsidian rename so links update (`alwaysUpdateLinks` is on).

---

## Frontmatter

```yaml
---
tags:
  - domain          # required type tag
  - commerce        # optional facet
aliases:
  - Optional search alias
---
```

Required type tags (pick one primary):  
`meta` · `moc` · `architecture` · `backend` · `frontend` · `domain` · `ops` · `docs` · `glossary` · `journey` · `decision` · `playbook` · `surface` · `code` · `guide`

---

## Content rules

- **Scannable:** bullets/tables over essays.
- **No secrets** in the vault.
- **No full OpenAPI dumps** — bridge to `apps/backend/docs/api/`.
- **Money/stock:** obey [[Money and stock rules]]; don’t invent alternate definitions.
- **Wire shapes:** obey [[Wire contracts]].
- **English titles** (content can mention Persian UI labels in body).

---

## Templates

Location: `00 Meta/templates/`

| Template | Use for |
|----------|---------|
| Domain note | `05 Domains/` |
| Decision | `11 Decisions/` |
| Playbook | `12 Playbooks/` |
| Journey | `09 Journeys/` |

Insert via Command palette → **Templates: Insert template**.

---

## Graph hygiene

- Hubs: [[Map of Content]] · [[System Atlas]] · [[Business Domains MOC]] · type MOCs
- Orphans: Graph → show orphans → link or delete
- Color groups: by folder path (see `.obsidian/graph.json`)

---

## What is “done” for a note

- [ ] Correct folder + title pattern  
- [ ] Frontmatter tags  
- [ ] What it is filled  
- [ ] Related links ≥2  
- [ ] MOC updated  
- [ ] Resolves in Graph (not orphan)  

---

## Related

[[How to add a note]] · [[How to use this vault]] · [[Known gaps]] · [[00 Home]] · [[Agent onboarding]]

#meta
