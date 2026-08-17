---
tags: [domain, analytics]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Analytics

## What it is

Two layers:

1. **Event ingest** — middleware captures events → buffered queue → analytics Postgres (Timescale). Drop-on-full; never block HTTP.
2. **Rollups & admin reads** — cron jobs write daily stats / search summaries; admin APIs feed [[Admin Analytics]] UI.

## Visitor cookies

Capture writes first-party **`sid`** (session) and **`did`** (device) cookies
(HttpOnly, SameSite=Lax, Secure in prod, 365d). Valid incoming UUIDs are reused;
missing ones are minted once and `Set-Cookie`'d. Store [[BFF Proxies]] copies
those cookie names upstream and the matching `Set-Cookie` back — it never
invents IDs.

## Event examples

- Product views, funnel events
- `search_performed` on storefront `GET /products?search=` (`query` + `results_count`; no `GET /search`) — feeds [[Search Backend]] aggregation job (PR-070d)

## Not for

- Authoritative stock or order state (that’s main DB)
- Joining into hot product list queries

## Related

[[Data Stores]] · [[ADR Dual databases main and analytics]] · [[Processes and Jobs]] · [[Admin Analytics]] · [[Observability]] · [[Search]] · [[BFF Proxies]]

#domain #analytics
