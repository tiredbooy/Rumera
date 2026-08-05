---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Dual databases main and analytics

**Status:** accepted

**Decision:** Main Postgres = system of record. Analytics/Timescale = events + rollups. Don’t join analytics into hot product queries.

**Consequences:** Two migrations trees · analytics fail-open (drop events) · seed only main.

Related: [[Data Stores]] · [[Analytics]] · [[Migrations]]
