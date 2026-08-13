# Rumera documentation map

**Purpose:** tell any reader *what documentation exists*, *where it lives*, and
*what is still thin* so they can navigate without tribal knowledge.

**Hub:** [`docs/README.md`](./README.md) — preferred human entry.  
**Dual-track process:** [`DOCUMENTATION-DUAL-TRACK.md`](./DOCUMENTATION-DUAL-TRACK.md) — project docs ↔ Obsidian brain (required for material changes).

---

## Physical layout (organized for discovery)

```
obsidian/                          # Obsidian vault (Graph view project map)
├── 00 Meta / 01 Maps / …
└── README.md                      # how to open vault

docs/                              # monorepo-wide long-form docs
├── README.md                      # hub
├── SYSTEM-OVERVIEW.md
├── DOCUMENTATION-MAP.md           # this file
├── DOCUMENTATION-DUAL-TRACK.md
├── PH-DUAL-DOC-MATRIX.md          # PH epic ↔ project ↔ Obsidian (PH-050a)
├── BACKLOG-PRODUCTION-HARDENING.md
├── FEATURE-ROADMAP.md
├── TESTING.md
└── DOCKER.md

apps/backend/docs/
├── README.md                      # backend hub
├── architecture.md + core guides  # getting-started, auth, ops, …
├── architecture/                  # deep-dives
│   ├── README.md
│   ├── inventory.md
│   ├── payments-and-webhooks.md
│   ├── media-pipeline.md
│   ├── search.md
│   └── …
└── api/                           # HTTP resource reference

apps/frontend/docs/
├── README.md                      # frontend hub
├── platform/                      # framework & infrastructure
│   ├── architecture.md
│   ├── bff-and-auth.md
│   ├── rbac.md
│   ├── api-layer.md
│   ├── data-fetching.md
│   └── design-system.md
└── features/                      # product journeys
    ├── domain-map.md
    ├── inventory.md
    ├── storefront-commerce.md
    ├── account-tour.md
    └── …
```

---

## How to read this repo (recommended order)

| Step | Document | Why |
|------|----------|-----|
| 1 | [`README.md`](../README.md) (root) | Product + one-command Docker |
| 2 | [`docs/README.md`](./README.md) | Doc hub |
| 3 | [`SYSTEM-OVERVIEW.md`](./SYSTEM-OVERVIEW.md) | End-to-end request & data flow |
| 4 | Backend [`how-it-works.md`](../apps/backend/docs/how-it-works.md) | Plain-language API |
| 5 | Backend [`architecture/`](../apps/backend/docs/architecture/README.md) | Deep dives as needed |
| 6 | Frontend [`AGENTS.md`](../apps/frontend/AGENTS.md) | Next.js 16 rules |
| 7 | Frontend [`platform/architecture.md`](../apps/frontend/docs/platform/architecture.md) | Routes & BFF |
| 8 | Frontend [`features/domain-map.md`](../apps/frontend/docs/features/domain-map.md) | Code ownership |

---

## Inventory by location

### Root / cross-cutting (`docs/`)

| Path | Covers |
|------|--------|
| [README.md](./README.md) | Hub + quick jumps |
| [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) | Full-system architecture |
| [DOCUMENTATION-MAP.md](./DOCUMENTATION-MAP.md) | This inventory |
| [DOCUMENTATION-DUAL-TRACK.md](./DOCUMENTATION-DUAL-TRACK.md) | Dual-track rules (project ↔ Obsidian) |
| [PH-DUAL-DOC-MATRIX.md](./PH-DUAL-DOC-MATRIX.md) | PH epic dual-doc closure map (PH-050a) |
| [READ-THE-SYSTEM.md](./READ-THE-SYSTEM.md) | Founder one-hour reading outline (PH-050b) |
| [BACKLOG-PRODUCTION-HARDENING.md](./BACKLOG-PRODUCTION-HARDENING.md) | Ordered hardening + product backlog pointer |
| [FEATURE-ROADMAP.md](./FEATURE-ROADMAP.md) | Shipped program + deferred / residuals |
| [TESTING.md](./TESTING.md) | Go unit/integration, Vitest, Playwright status |
| [DOCKER.md](./DOCKER.md) | Compose, nginx |
| IMPROVEMENT-OPPORTUNITIES | Historical audit + PH status overlay |

### Backend core (`apps/backend/docs/`)

| Path | Covers |
|------|--------|
| README, how-it-works, getting-started | Onboarding |
| architecture.md, conventions, authentication | Core design |
| operations, observability | Run/prod |
| api/* | Endpoint reference |

### Backend architecture (`apps/backend/docs/architecture/`)

| Path | Covers |
|------|--------|
| [README.md](../apps/backend/docs/architecture/README.md) | Index |
| domain-map.md | Capability → packages |
| data-stores.md | All data planes |
| **inventory.md** | Stock model + order lifecycle |
| payments-and-webhooks.md | Settlement |
| money-and-stock-sagas.md | End-to-end money narrative (PH-000c) |
| idempotency.md · idempotency-runbook.md | Money replay platform (PH-011) |
| error-messages.md | User-clear error catalogue (PH-012c) |
| rbac.md | Staff capabilities (PH-021) |
| loyalty.md | Cellar Club rules (PH-040) |
| wallet-topup.md | Gateway top-up (PH-041) |
| gift-card-purchase.md | Customer buy gift card (PH-042) |
| box-subscriptions.md | Cellar box model (PH-043) |
| media-pipeline.md | Uploads / transforms |
| search.md | Product search + analytics + Meili readiness |
| notifications-kafka.md | Async notify |
| processes-and-jobs.md | Binaries + cron |

### Frontend platform (`apps/frontend/docs/platform/`)

| Path | Covers |
|------|--------|
| architecture, bff-and-auth, rbac | App structure & access |
| api-layer, data-fetching | Data movement |
| design-system | Visual / RTL |

### Frontend features (`apps/frontend/docs/features/`)

| Path | Covers |
|------|--------|
| domain-map | Ownership of `features/*` |
| media-and-cache | Media + Next cache tags |
| storefront-commerce | Catalogue / cart / checkout |
| search | `/search` UX |
| account-tour | Customer dashboard |
| loyalty · wallet · gift-cards · subscriptions | Growth account surfaces (PH-040…043) |
| content-and-seo | Home, journal, recipes, SEO |
| recipe-commerce | Recipe → shop |
| admin-console | Staff shell |
| **inventory.md** | Admin inventory UI |
| brand-system, pwa, api-monitoring | Brand, PWA, Prometheus board |

### Process (not product docs)

`refactor-workstreams/`, `refactor-logs/` — task tracking only.

---

## Coverage matrix

| Product area | Backend | Frontend |
|--------------|---------|----------|
| Auth / sessions | Doc + API | platform/bff-and-auth |
| RBAC | authentication | platform/rbac |
| Catalogue / cart / checkout | API | features/storefront-commerce |
| **Inventory** | **architecture/inventory** + API | **features/inventory** |
| Payments / webhooks | architecture/payments-and-webhooks | commerce + admin payments |
| Account (wallet, loyalty, …) | API + wallet-topup / loyalty / gift / box | features/account-tour + domain FE docs |
| Search | architecture/search | features/search |
| Media | architecture/media-pipeline | features/media-and-cache |
| Notifications | architecture/notifications-kafka | — |
| Admin shell | — | features/admin-console |
| Dual-doc PH program | PH-DUAL-DOC-MATRIX | Obsidian Connect + Journeys MOC |
| Testing | docs/TESTING | Vitest section |
| Docker | docs/DOCKER | — |

---

## Residual gaps

1. **Env var encyclopedia** — single table of every config env (partially in `.env*.example`).
2. **Migration runbook** — main vs analytics goose, reset, order of apply.
3. **Playwright runbook** — after Task 062 lands a suite (stub in TESTING.md).
4. **Age gate / compliance** — small surface, still code-only.
5. **Persian OG font vendoring** — acceptance note only.
6. ~~**PH-050b** one-hour outline~~ — [READ-THE-SYSTEM.md](./READ-THE-SYSTEM.md).
7. Product residuals listed in [FEATURE-ROADMAP.md](./FEATURE-ROADMAP.md) (gateway redirect URL, sub address PATCH, Meili cutover, …).

---

## Writing conventions

- **Clear and detailed:** who-for blurb, mental model, code map, do/don’t, related links.
- **Right folder:** platform/architecture vs features/journey vs api/contract.
- **Real paths** (`internal/features/<domain>/…`, `apps/frontend/features/…`).
- Link from hub READMEs + this map when adding a file.
- Dual-track: [DOCUMENTATION-DUAL-TRACK.md](./DOCUMENTATION-DUAL-TRACK.md) · program matrix [PH-DUAL-DOC-MATRIX.md](./PH-DUAL-DOC-MATRIX.md).
