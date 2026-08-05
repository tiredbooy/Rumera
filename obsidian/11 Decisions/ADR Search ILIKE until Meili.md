---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Search ILIKE until Meili

**Status:** current state / transitional

**Decision:** Product search uses Postgres `ILIKE` on title. Meili types/config prepared but client not wired.

**Consequences:** No typo tolerance · analytics search job is **not** Meili indexer · enabling Meili needs indexer + FE cutover.

Related: [[Search Backend]] · [[Search]] · [[Search FE]]
