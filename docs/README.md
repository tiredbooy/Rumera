# Rumera documentation hub

Start here if you are new to the monorepo. Docs are split by **audience** and
**depth** so you can jump without scrolling a single giant file.

---

## Start here (everyone)

| Order | Doc | Why |
|------:|-----|-----|
| 0 | [../obsidian/](../obsidian/) | **Obsidian vault** — visual Graph map of the whole project (`[[wikilinks]]`) |
| 1 | [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) | End-to-end: processes, request paths, data stores |
| 2 | [DOCUMENTATION-MAP.md](./DOCUMENTATION-MAP.md) | Full inventory of docs, coverage matrix, residual gaps |
| 3 | [TESTING.md](./TESTING.md) | How to run Go / Vitest / (future) Playwright |
| 4 | [DOCKER.md](./DOCKER.md) | Compose stacks, nginx, local platform |

Root product README: [`../README.md`](../README.md).

### Obsidian graph vault

Open folder **`Rumera/obsidian`** as an Obsidian vault (not the monorepo root).

| Note | Purpose |
|------|---------|
| `Brain/Project Brain.md` | **Graph center** — all folders connect here |
| `Brain/Connect *.md` | One connector per area folder |
| `00 Meta/How to use this vault.md` | Graph, reading modes, folder map |
| `00 Meta/How to add a note.md` | **Required** format + checklist for new notes |
| `00 Meta/Vault conventions.md` | Hard rules |
| `01 Maps/Known gaps.md` | What’s still thin |
| `00 Meta/00 Home.md` / `Map of Content.md` | Entry hubs |

Then open **Graph view** (`Ctrl/Cmd+G`). Bridge notes link into these markdown guides.

---

## By app

### Backend (`apps/backend/docs/`)

| Path | Contents |
|------|----------|
| [README.md](../apps/backend/docs/README.md) | Backend hub |
| [architecture/](../apps/backend/docs/architecture/) | Inventory, payments, media, search, Kafka, jobs, data stores |
| [api/](../apps/backend/docs/api/) | Per-resource HTTP reference |
| getting-started, conventions, authentication, operations, observability | Day-to-day engineering |

### Frontend (`apps/frontend/docs/`)

| Path | Contents |
|------|----------|
| [README.md](../apps/frontend/docs/README.md) | Frontend hub |
| [platform/](../apps/frontend/docs/platform/) | Architecture, BFF/auth, RBAC, API layer, data fetching, design |
| [features/](../apps/frontend/docs/features/) | Commerce, account, inventory UI, search, SEO, PWA, admin, … |

---

## Quick jumps

| Topic | Doc |
|-------|-----|
| Stock / reserve / deduct | [backend architecture/inventory](../apps/backend/docs/architecture/inventory.md) + [FE inventory](../apps/frontend/docs/features/inventory.md) |
| Payments & webhooks | [payments-and-webhooks](../apps/backend/docs/architecture/payments-and-webhooks.md) |
| Customer `/account` | [account-tour](../apps/frontend/docs/features/account-tour.md) |
| Search | [BE search](../apps/backend/docs/architecture/search.md) · [FE search](../apps/frontend/docs/features/search.md) |
| Media URLs | [media-pipeline](../apps/backend/docs/architecture/media-pipeline.md) · [media-and-cache](../apps/frontend/docs/features/media-and-cache.md) |
| Domain ownership (FE) | [domain-map](../apps/frontend/docs/features/domain-map.md) |

---

## Process / history (not product architecture)

| Path | Role |
|------|------|
| `refactor-workstreams/Refactor-Docs/` | Active task trackers, acceptance audit |
| `refactor-logs/` | Per-task archaeology |
| `FEATURE-ROADMAP.md`, `IMPROVEMENT-OPPORTUNITIES.md` | Historical product notes |

---

## Writing new docs

1. Put **platform / system** material under `apps/*/docs/architecture` or
   `apps/frontend/docs/platform/`.
2. Put **product journeys** under `apps/frontend/docs/features/` or backend
   `architecture/` with a clear name.
3. Keep **HTTP field lists** in `apps/backend/docs/api/`.
4. Link the new file from this hub, the app `docs/README.md`, and
   [DOCUMENTATION-MAP.md](./DOCUMENTATION-MAP.md).
5. Prefer complete sentences and real repo paths over abstract diagrams alone.
