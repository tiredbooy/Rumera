---
tags:
  - map
  - monorepo
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 01 Maps]]


# Project Structure

Monorepo layout (no shared package workspace — FE talks HTTP to BE).

```text
Rumera/
├── apps/
│   ├── backend/          → [[Backend API]]
│   │   ├── cmd/          → [[Processes and Jobs]]
│   │   ├── internal/     → handlers · services · repos
│   │   ├── migrations/   → [[Data Stores]]
│   │   └── docs/         → [[Docs Bridge Backend]]
│   └── frontend/         → [[Frontend App]]
│       ├── app/          → routes (thin)
│       ├── features/     → [[Frontend Domain Map]]
│       ├── lib/          → [[Platform Layer]]
│       └── docs/         → [[Docs Bridge Frontend]]
├── docs/                 → [[Docs Bridge Root]]
├── obsidian/             → this vault
├── infra/nginx/          → [[Docker and Local Dev]]
└── docker-compose.*.yml
```

## Entry binaries

| Cmd | Note |
|-----|------|
| `cmd/server` | HTTP API + cron + analytics queue |
| `cmd/seed` | [[Seed and Demo Data]] |
| `cmd/notification-worker` | [[Notifications]] |
| `cmd/media-reconcile` | [[Media Pipeline]] |

## Links

- [[System Atlas]] · [[Map of Content]] · [[Runtime Topology]]
- Repo README: `../README.md`

#map #monorepo
