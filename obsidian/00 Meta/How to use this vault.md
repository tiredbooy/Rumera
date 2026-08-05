---
tags:
  - meta
  - guide
  - required-reading
aliases:
  - Vault usage
  - Using Obsidian
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 00 Meta]]


# How to use this vault

**Required reading** before you edit the brain. Pair with [[How to add a note]]
(format + checklist) and [[Vault conventions]] (rules).

---

## What this vault is

| This vault (`obsidian/`) | Repo docs (`docs/`, `apps/*/docs/`) |
|--------------------------|-------------------------------------|
| Project **brain**: concepts, links, journeys, ADRs, playbooks | Long-form **manuals**: APIs, runbooks, architecture prose |
| Optimized for **Graph view** (wikilinks) | Optimized for depth and exact contracts |
| Star graph around [[Project Brain]] | Can be long; don’t duplicate tables here |

If a fact needs a 50-line API table → put it in repo docs and **bridge** from here.

---

## Open the vault (first time)

1. Install [Obsidian](https://obsidian.md) (desktop).
2. **Open folder as vault** → choose exactly:
   ```text
   …/Rumera/obsidian
   ```
   Do **not** open the monorepo root (the graph would include noise).
3. Trust the workspace if prompted; Graph + file explorer should appear.
4. Open **[[Project Brain]]** (`Brain/` folder) — the graph **center**.
5. Or [[00 Home]] / [[Map of Content]] for indexes.

---

## Graph center: the Brain folder

```text
Brain/
  Project Brain.md          ← OPEN THIS · gold center node
  Connect 00 Meta.md        ← rays to each area
  Connect 01 Maps.md
  …
  Connect 13 Surfaces.md
```

Every content note also links **up** to Project Brain + its Connect note. That is
why the Graph looks like a synapse, not islands.

---

## Daily usage patterns

### 1) Explore with the Graph (recommended)

1. Open **[[Project Brain]]**.
2. `Ctrl+G` / `Cmd+G` → **Graph**, then **Local graph** on Project Brain.
3. You should see rays to every **Connect …** note, then out to domains.
4. Leave **Arrows** and **Tags** on; **Brain** folder is gold.
5. Click a Connect node (e.g. [[Connect 05 Domains]]) → then a domain note.
6. Use **Outgoing links** / **Backlinks** side panes.

**Good trails**

| Goal | Start at |
|------|----------|
| Whole-project star | [[Project Brain]] local graph |
| Understand money path | [[Journey First purchase]] or [[Money and stock rules]] |
| Stock bugs | [[Inventory]] → [[Playbook Debug Oversell]] |
| Auth | [[Auth and Sessions]] → [[Journey OTP login]] |
| “Where is the code?” | [[Code Maps MOC]] |
| “Why did we do X?” | [[Decisions MOC]] |
| “What does this word mean?” | [[Glossary]] |

### 2) Read as documentation

1. [[Agent onboarding]] (30‑minute path).
2. Domain of your work from [[Business Domains MOC]].
3. Jump to long docs via [[Documentation Bridge]] when you need full detail.

### 3) Fix a production-ish issue

1. [[Playbooks MOC]] → matching playbook.
2. Follow linked domains + backend notes.
3. After the fix, **update the playbook** if you learned a new step.

### 4) Design or implement a feature

1. Check [[Decisions MOC]] + [[Pitfalls and anti-patterns]].
2. Implement following [[Wire contracts]] · [[Money and stock rules]].
3. **Add or update vault notes** the same session — see [[How to add a note]]
   (must update the folder’s **Connect** note under `Brain/`).

### 5) Onboard an AI agent

1. [[Project Brain]]
2. [[Agent onboarding]]
3. [[How to add a note]] (if writing notes)
4. Domain MOC for the task

---

## UI cheat-sheet (Obsidian)

| Action | Typical shortcut |
|--------|------------------|
| Graph view | `Ctrl/Cmd + G` |
| Quick switcher | `Ctrl/Cmd + O` |
| Search in vault | `Ctrl/Cmd + Shift + F` |
| Command palette | `Ctrl/Cmd + P` |

Enable side panes: **Backlinks**, **Outgoing links**, **Tags**, **Outline**.

---

## Folder map

| Folder | Connect note | Purpose |
|--------|--------------|---------|
| `Brain/` | [[Project Brain]] | Graph center |
| `00 Meta` | [[Connect 00 Meta]] | Usage, conventions, templates |
| `01 Maps` | [[Connect 01 Maps]] | MOCs, atlas |
| `02 Architecture` | [[Connect 02 Architecture]] | Cross-cutting design |
| `03 Backend` | [[Connect 03 Backend]] | Go API |
| `04 Frontend` | [[Connect 04 Frontend]] | Next.js |
| `05 Domains` | [[Connect 05 Domains]] | Business language |
| `06 Ops` | [[Connect 06 Ops]] | Run/test/env |
| `07 Docs Bridge` | [[Connect 07 Docs Bridge]] | Repo manuals |
| `08 Glossary` | [[Connect 08 Glossary]] | Terms |
| `09 Journeys` | [[Connect 09 Journeys]] | E2E stories |
| `10 Code Maps` | [[Connect 10 Code Maps]] | Package trees |
| `11 Decisions` | [[Connect 11 Decisions]] | ADRs |
| `12 Playbooks` | [[Connect 12 Playbooks]] | Debug / how-to |
| `13 Surfaces` | [[Connect 13 Surfaces]] | URL surfaces |

---

## Related

- **Adding notes:** [[How to add a note]]
- **Rules:** [[Vault conventions]]
- **Gaps:** [[Known gaps]]
- **Center:** [[Project Brain]]
- **Entry:** [[00 Home]] · [[Map of Content]]

#meta #guide
