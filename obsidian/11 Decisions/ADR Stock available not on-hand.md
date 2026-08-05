---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Stock available not on-hand

**Status:** accepted

**Decision:** Sellable quantity is **available** = on_hand − committed. Catalogue/cart must not sell committed units.

**Consequences:** Two checkouts cannot both buy the last reserved bottle · UI must show available prominently ([[Inventory FE]]).

Related: [[Money and stock rules]] · [[Inventory]] · [[Term available_stock]]
