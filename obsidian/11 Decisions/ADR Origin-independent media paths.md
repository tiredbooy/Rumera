---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Origin-independent media paths

**Status:** accepted

**Decision:** DB stores `/media/{key}` or external https — never `localhost:8080`. FE joins origin in one resolver.

**Consequences:** FE/BE ports can diverge · prod configured origins must be https · [[Media and Cache FE]] is mandatory.

Related: [[Media Pipeline]] · [[Playbook Debug Media broken image]]
