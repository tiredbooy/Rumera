# Dual-track documentation (project docs ↔ Obsidian brain)

**Status:** Canonical process (2026-08-11).  
**Program:** `refactor-workstreams/production-hardening-and-product/`  
**Audience:** humans and agents shipping changes to Rumera.

This repo keeps **two documentation tracks**. Both are required for material
changes. Neither replaces the other.

| Track | Location | Job |
| --- | --- | --- |
| **Project docs** | `docs/`, `apps/backend/docs/`, `apps/frontend/docs/` | Canonical depth: procedures, API contracts, architecture guides, runbooks |
| **Obsidian brain** | `obsidian/` (open as vault) | Graph map: short notes, wikilinks, journeys, decisions, playbooks, mental models |

**Rule of thumb**

- Long tables, field lists, step-by-step ops → **project docs**.
- “What is this?”, “who owns it?”, “how does the journey flow?”, Graph edges → **Obsidian**.
- If only one track is updated, the task is **not finished**.

---

## 1. What lives where

### Project docs (source of truth for depth)

| Area | Path | Content |
| --- | --- | --- |
| Monorepo hub | `docs/README.md`, `SYSTEM-OVERVIEW.md` | Entry, system picture, testing, Docker |
| Inventory | `docs/DOCUMENTATION-MAP.md` | What exists / coverage |
| **This process** | `docs/DOCUMENTATION-DUAL-TRACK.md` | Dual-track rules (this file) |
| Product backlog | `docs/FEATURE-ROADMAP.md`, `BACKLOG-PRODUCTION-HARDENING.md` | Intentional product follow-ups |
| PH dual-doc matrix | `docs/PH-DUAL-DOC-MATRIX.md` | PH epic ↔ project ↔ Obsidian closure (PH-050a) |
| Backend hub | `apps/backend/docs/README.md` | Architecture, auth, ops, conventions |
| Backend architecture | `apps/backend/docs/architecture/` | Deep dives (inventory, payments, search, jobs, …) |
| Backend HTTP | `apps/backend/docs/api/` | Per-resource contracts |
| Frontend hub | `apps/frontend/docs/` | Platform + feature journeys |
| Workstreams | `refactor-workstreams/*/` | Task claim protocol — **not** product docs |

### Obsidian brain (source of truth for the map)

| Folder | Content |
| --- | --- |
| `Brain/` | [[Project Brain]] center + `Connect NN …` per area |
| `00 Meta` | How to use / add notes, vault conventions |
| `01 Maps` | MOCs, System Atlas, Known gaps |
| `02 Architecture` | Cross-cutting design (auth, money rules, RBAC, …) |
| `03 Backend` / `04 Frontend` | Ownership notes |
| `05 Domains` | Business language |
| `06 Ops` | Local run, test, migrate, env |
| `07 Docs Bridge` | Links **into** project docs paths |
| `08 Glossary` | `Term …` notes |
| `09 Journeys` | End-to-end stories |
| `10 Code Maps` | Package / feature trees |
| `11 Decisions` | ADRs (short; link repo ADR if long) |
| `12 Playbooks` | How-to / debug procedures |
| `13 Surfaces` | Storefront / admin / auth surfaces |

Vault notes stay **short**. Prefer a bridge link over pasting a full API table.

---

## 2. Sync rules

1. **Same decision, both places** — If you change money, stock, auth, search, or a customer journey, update project depth **and** the matching Obsidian domain / journey / architecture note.
2. **ADR when material** — Behaviour or contract that future agents must not reinvent →  
   - Long form (optional): `apps/backend/docs/architecture/` or `docs/`  
   - Always: Obsidian `11 Decisions/ADR ….md` with links to domains constrained  
3. **Bridge notes** — When a repo path moves or a major new guide appears, update `obsidian/07 Docs Bridge/*`.
4. **Known gaps** — Closing a gap → move row in `obsidian/01 Maps/Known gaps.md`; opening work → add or keep the gap until shipped.
5. **No CI requirement** — Documentation quality is verified by human/agent checklist at task finish (founder has no server CI for now).
6. **Workstream ≠ product** — `FINISHED.md` records implementation; product truth still goes to project docs + brain.

---

## 3. When to write an ADR

Write an ADR (project and/or Obsidian `11 Decisions/`) when **any** of these is true:

- Money path, stock reservation, or wallet ledger behaviour changes
- Auth / session / RBAC enforcement model changes
- Search strategy (ILIKE vs Meili) or index contract changes
- You choose **not** to build something others will re-propose (deferred multi-currency, crypto, Netflix-style subs, CI-until-server)
- A feature package owns a new cross-feature boundary

Skip ADR for pure renames, comment-only, or one-line bugfixes with no behavioural story.

---

## 4. Change-type matrix (minimum dual-track touch)

| Change type | Project docs | Obsidian |
| --- | --- | --- |
| **Money** (orders, payments, wallet, gift card, coupons on checkout) | `architecture/payments-and-webhooks.md` and/or `money-and-stock-sagas.md`, relevant `api/*` | Domain notes + journey; [[Money and stock rules]]; ADR if policy changes |
| **Inventory / stock** | `architecture/inventory.md`, `api/inventory.md` | [[Inventory]], [[Inventory Backend]], oversell playbook, admin restock journey |
| **Auth / sessions / RBAC** | `authentication.md`, FE `bff-and-auth` / `rbac` | [[Auth and Sessions]], [[RBAC]], OTP/login journeys |
| **New backend endpoint** | `api/<resource>.md`, conventions if pattern new | Backend note + domain; playbook “Add backend endpoint” if pattern doc changes |
| **New admin module** | FE feature doc | [[Admin Console]], playbook Add admin module, surface Admin |
| **Search** | `architecture/search.md` | Search Backend + Search domain |
| **Cron / jobs / outbox** | `architecture/processes-and-jobs.md`, notifications | Processes and Jobs, relevant journeys |
| **Storefront UX only** | FE feature doc | Domain + journey if customer-visible flow changes |
| **Deferred / out of scope** | FEATURE-ROADMAP + deferred ADR | Known gaps + Decision |

**Hard rule — money / auth / inventory:** every such change gets at least:

1. Project architecture or API update  
2. Obsidian **domain** note touch  
3. Obsidian **journey** note create-or-update (when the customer or operator path changed)

---

## 5. Task definition of done (docs)

A workstream task that changes behaviour is done only when:

- [ ] Project docs updated (paths listed in FINISHED record)
- [ ] Obsidian notes updated (titles listed; wikilinks not broken)
- [ ] Bridge updated if a new top-level guide was added
- [ ] Known gaps adjusted if relevant
- [ ] Local code verify as required by the task (**no CI gate**)

---

## 6. How agents should work

1. Read this file + `DOCUMENTATION-MAP.md` + relevant architecture page.  
2. Open vault mental model: Project Brain → domain → journey.  
3. Implement code.  
4. Update both tracks **in the same claim** as the code.  
5. Record doc paths in `FINISHED.md`.

Preferred reading order for newcomers is in `DOCUMENTATION-MAP.md` and Phase task **PH-050b** (“read the system in one hour”).

---

## Related

- [DOCUMENTATION-MAP.md](./DOCUMENTATION-MAP.md) — inventory  
- [BACKLOG-PRODUCTION-HARDENING.md](./BACKLOG-PRODUCTION-HARDENING.md) — ordered program  
- Obsidian: vault conventions, Documentation Bridge, Playbook Document a change  
