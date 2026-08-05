---
tags:
  - backend
  - hub
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Backend API

Go e-commerce API (Gin + pgx). Base `/api/v1`.

## Owns

- [[Layered Backend]] · [[Backend Domain Map]]
- [[Inventory Backend]] · [[Payments Backend]] · [[Media Pipeline]]
- [[Search Backend]] · [[Notifications]] · [[Processes and Jobs]]
- [[Data Stores]] · [[Observability]]

## Not owns

UI — that is [[Frontend App]] via HTTP.

## Entry

`cmd/server` — also starts analytics queue + [[Processes and Jobs|cron]].

Related: [[System Atlas]] · [[Runtime Topology]] · [[Docs Bridge Backend]]

Bridge hub: `apps/backend/docs/README.md`

#backend #hub
