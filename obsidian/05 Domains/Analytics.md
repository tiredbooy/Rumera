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

## Event examples

- Product views, funnel events
- `search_performed` (feeds [[Search Backend]] aggregation job)

## Not for

- Authoritative stock or order state (that’s main DB)
- Joining into hot product list queries

## Related

[[Data Stores]] · [[ADR Dual databases main and analytics]] · [[Processes and Jobs]] · [[Admin Analytics]] · [[Observability]] · [[Search]]

#domain #analytics
