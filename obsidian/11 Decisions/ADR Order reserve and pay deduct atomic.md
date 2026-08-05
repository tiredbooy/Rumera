---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Order reserve and pay deduct atomic

**Status:** accepted

**Decision:**

1. Reserve inventory **inside** CreateOrder transaction.
2. Deduct inventory **inside** Payment Confirm transaction with mark-paid.

**Consequences:** No orphan pending orders without stock · no paid-without-deduct drift · webhooks must hit Confirm path.

Related: [[Orders]] · [[Payments Backend]] · [[Inventory Backend]] · [[Playbook Debug Oversell]]
