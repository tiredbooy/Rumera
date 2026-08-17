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

- [[Layered Backend]] · [[Backend Domain Map]] · [[Backend package map]]
- [[Addresses Backend]] · [[ADR Backend feature packages]]
- [[Inventory Backend]] · [[Payments Backend]] · [[Media Pipeline]]
- [[Search Backend]] · [[Notifications]] · [[Processes and Jobs]]
- [[Data Stores]] · [[Observability]]

## Not owns

UI — that is [[Frontend App]] via HTTP.

## Entry

`cmd/server` — also starts analytics queue + [[Processes and Jobs|cron]].

## Catalogue + cart lists (PR-010f)

Depth is in the API files; this is the map.

- Staff product list: `GET /admin/products` — same `{results, pagination}` as public `GET /products`, includes drafts; honors `is_active`, `search`, `page`, `limit` (max 100). `apps/backend/docs/api/products.md`. [[Catalogue]]
- Bulk cart add: `POST /cart/items/bulk` — `AddCartItemsReq` / `BulkAddResult` with skip reasons `invalid|not_found|unavailable|out_of_stock`. [[Cart Backend]] · [[Cart and Checkout]]
- Tag list: public `GET /tags` only (`limit≤100`). **No** `GET /admin/tags`. Admin typeahead uses the public list. Writes stay `POST/PATCH/DELETE /admin/tags`. Brand list equivalent is PR-010e on the brands API.

Bridge: [[Docs Bridge Backend]] · [[Known gaps]]

Related: [[System Atlas]] · [[Runtime Topology]] · [[Docs Bridge Backend]]

Bridge hub: `apps/backend/docs/README.md`

#backend #hub
