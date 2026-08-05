---
tags:
  - meta
  - guide
  - required-reading
aliases:
  - Add a note
  - Note format
  - New note
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 00 Meta]]


# How to add a note

**Required reading** whenever you create or substantially edit a vault note.
Follow this so Graph view, search, and future agents stay coherent.

Also read: [[How to use this vault]] · [[Vault conventions]]

---

## Before you write

Answer these three questions:

1. **Does a note already exist?** Use Quick switcher (`Ctrl/Cmd+O`) or search.
   Prefer **editing** over duplicating (e.g. don’t create “Stock” if [[Inventory]] exists).
2. **What type is it?** Pick one type from the table below — that chooses folder + title pattern + template.
3. **What must it link to?** Minimum **two** existing notes **plus** the folder’s
   `Connect …` note under `Brain/` (everything hangs off [[Project Brain]]).

If the content is a long API table or full guide → write/update **repo docs** under
`apps/*/docs/` or `docs/`, then add a short vault note + [[Documentation Bridge]] link.

---

## Note types → folder → title format

| Type | Folder | Title pattern | Template |
|------|--------|---------------|----------|
| **Brain center** | `Brain/` | Only maintain [[Project Brain]] + `Connect …` | Do not add random notes here |
| Hub / MOC | `01 Maps/` | `… MOC`, `… Atlas`, `Map of …` | (hand-written) |
| Meta / guide | `00 Meta/` | Clear imperative or “How to …” | — |
| Architecture | `02 Architecture/` | System concept (no “FE/BE” unless split) | — |
| Backend | `03 Backend/` | `… Backend` or `Backend …` | — |
| Frontend | `04 Frontend/` | `… FE` or `Frontend …` | — |
| Domain | `05 Domains/` | Business name (`Inventory`, `Catalogue`) | **Domain note** |
| Ops | `06 Ops/` | Ops topic | — |
| Docs bridge | `07 Docs Bridge/` | `Docs Bridge …` | — |
| Glossary term | `08 Glossary/` | `Term <name>` | — |
| Journey | `09 Journeys/` | `Journey <verb phrase>` | **Journey** |
| Code map | `10 Code Maps/` | `… map` | — |
| Decision / ADR | `11 Decisions/` | `ADR <short title>` | **Decision** |
| Playbook | `12 Playbooks/` | `Playbook <action or debug topic>` | **Playbook** |
| Surface | `13 Surfaces/` | `Surface <name>` | — |

### Naming rules

- **Title = filename** (Obsidian default). Graph labels use the title.
- Prefer **spaces** and readable English: `Playbook Debug Webhook.md` not `pb_dbg_wh.md`.
- **Stable names:** renaming breaks wikilinks unless you use Obsidian rename (updates links) or set `aliases`.
- Glossary: always prefix `Term ` so terms cluster and don’t clash with domain titles
  (`Term session` vs a future “Session” feature note).
- Don’t create two notes with the **same title** in different folders (wikilink collision).

---

## Required format (every note)

Use this skeleton unless a template is more specific.

```markdown
---
tags:
  - <type-tag>
  - <optional-area>
aliases: []
---

**Brain:** [[Project Brain]] · [[Connect NN Folder]]

# <Same as file title>

## What it is
One short paragraph. Anyone should understand without opening code.

## Details
(bullets, small tables, or mermaid/text diagrams — keep it scannable)

## Code map
(optional) paths like `apps/backend/internal/services/…`

## Repo docs
(optional) relative path from vault, e.g. `../apps/backend/docs/architecture/….md`

## Related

[[Business Domains MOC]] · [[Map of Content]]

#type-tag
```
*(Replace Related links with real notes for your topic.)*
```

### Frontmatter rules

| Field | Required | Rules |
|-------|----------|--------|
| `tags` | **Yes** | YAML list. Include one type tag: `domain`, `backend`, `frontend`, `architecture`, `ops`, `journey`, `decision`, `playbook`, `glossary`, `surface`, `moc`, `meta`, `code`. |
| `aliases` | No | Alternate titles people might search (`Stock`, `Warehouse`). |
| `cssclasses` | No | Rare; hubs only. |

### Body rules

1. **H1 once** = note title (matches filename).
2. **What it is** first — no wall of text before the point.
3. Prefer bullets and tables over long paragraphs.
4. End with **Related** (wikilinks). Optional `#tag` line at the bottom is fine for Graph filters.
5. **Wikilinks** for concepts: `[[Inventory]]`, not bare “inventory” if a note exists.
6. **Display text:** `[[Inventory Backend|backend inventory]]` if needed.
7. **Repo files:** normal markdown links relative to vault:
   `[inventory.md](../apps/backend/docs/architecture/inventory.md)`
8. Do **not** paste secrets, tokens, or production passwords.

---

## Step-by-step: create a note

### A) Using a template (preferred)

1. Create empty note in the **correct folder** (right-click folder → New note).
2. Name it with the **final title** (e.g. `Journey Cancel unpaid order`).
3. Command palette → **Templates: Insert template** → pick Domain / Decision / Journey / Playbook.
4. Fill every section; delete unused optional headings if empty.
5. Add links (see checklist below).
6. Update the matching **MOC** so the note is discoverable.

### B) Without template

1. Copy the skeleton above.
2. Same linking + MOC steps.

### C) Glossary term

1. File: `08 Glossary/Term my concept.md`
2. Title: `# Term: my concept` or `# Term my concept` (keep `Term` in filename).
3. 3–8 lines definition + links to domain/architecture notes.
4. Add the term to [[Glossary]] index list.

---

## Linking checklist (minimum)

Before you stop, ensure:

- [ ] **≥ 2** wikilinks to existing notes
- [ ] Linked from the right **MOC** (see table)
- [ ] Listed on the folder’s **Connect** note under `Brain/` (so it hangs off [[Project Brain]])
- [ ] Prefer a one-line `**Brain:** [[Project Brain]] · [[Connect …]]` under frontmatter (same as existing notes)
- [ ] If domain: links to BE note and/or FE note when they exist
- [ ] If playbook/journey: links to domains it touches
- [ ] If code changed in the same work: [[Code Maps MOC]] or package/feature map updated if structure changed
- [ ] No unresolved link (create stub or fix spelling)
- [ ] Listed on [[Map of Content]] only if it’s a **hub** or major new domain (not every leaf)

### Which MOC / Connect to update

| You added… | Also update |
|------------|-------------|
| Domain | [[Business Domains MOC]] + [[Connect 05 Domains]] |
| Journey | [[Journeys MOC]] + [[Connect 09 Journeys]] |
| Playbook | [[Playbooks MOC]] + [[Connect 12 Playbooks]] |
| Decision | [[Decisions MOC]] + [[Connect 11 Decisions]] |
| Code map | [[Code Maps MOC]] + [[Connect 10 Code Maps]] |
| Surface | [[Surfaces MOC]] + [[Connect 13 Surfaces]] |
| Glossary term | [[Glossary]] + [[Connect 08 Glossary]] |
| Backend note | [[Connect 03 Backend]] |
| Frontend note | [[Connect 04 Frontend]] |
| Ops note | [[Connect 06 Ops]] |
| Architecture note | [[Connect 02 Architecture]] |
| Major hub / atlas | [[Map of Content]] + [[Project Brain]] if foundational |

---

## Type-specific checklists

### Domain (`05 Domains/`)

- [ ] Business language title (not a package path)
- [ ] What it is + lifecycle or rules if any
- [ ] Code ownership (BE/FE paths or links to `… Backend` / `… FE` notes)
- [ ] Links: [[Business Domains MOC]] + related domains
- [ ] Optional: journey + playbook links

### Decision (`11 Decisions/`)

- [ ] Title starts with `ADR `
- [ ] Status: `proposed` | `accepted` | `superseded`
- [ ] Context / Decision / Consequences
- [ ] Linked from [[Decisions MOC]]
- [ ] Linked from systems it constrains

### Playbook (`12 Playbooks/`)

- [ ] Title starts with `Playbook `
- [ ] Symptoms **or** “when to use”
- [ ] Numbered steps
- [ ] Linked from [[Playbooks MOC]]
- [ ] Points at domains, not only code paths

### Journey (`09 Journeys/`)

- [ ] Title starts with `Journey `
- [ ] Actor + happy path steps
- [ ] Failure branches if relevant
- [ ] Domains touched as wikilinks
- [ ] Linked from [[Journeys MOC]]

### Backend / Frontend split notes

When both exist (e.g. inventory):

- Domain: [[Inventory]] (business)
- BE: [[Inventory Backend]]
- FE: [[Inventory FE]]

Cross-link all three.

---

## Anti-patterns (don’t)

| Don’t | Do |
|-------|-----|
| Dump a whole API reference into the vault | Bridge to `docs/api/…` |
| Create `Notes.md` / `Misc.md` | Pick a type and folder |
| Wikilink to a title you’ll “write later” and forget | Create a **stub** (What it is + Related) the same day |
| Rename files outside Obsidian without fixing links | Rename inside Obsidian |
| Duplicate [[System Atlas]] content in every note | Link to the atlas |
| Put personal diary noise in shared vault | Use a private folder or local-only vault |

---

## After you add notes: quality gate

1. Open **Graph** → filter path of your folder → node is connected, not floating.
2. Open the note → **Outgoing links** all resolve (no missing targets).
3. Open the MOC you updated → new entry is visible.
4. If this was part of a product change, mention the vault update in the PR/session notes.

---

## Stubs

A stub is valid if the topic is real but thin:

```markdown
---
tags: [domain]
---

# Example Domain

## What it is
TBD — exists in code under `features/example`. Fill after reading handlers.

## Related

[[Business Domains MOC]] · [[Frontend Domain Map]]

#domain
```

Add to the MOC with a “(stub)” only if you want; better: fill “What it is” in one sentence.

---

## Related

[[How to use this vault]] · [[Vault conventions]] · [[Known gaps]] · [[Agent onboarding]] · [[00 Home]] · [[Map of Content]]

#meta #guide
