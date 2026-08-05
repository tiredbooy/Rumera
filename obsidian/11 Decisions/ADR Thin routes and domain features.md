---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Thin routes and domain features

**Status:** accepted

**Context:** Central `lib/catalog` and fat pages caused import chaos and type drift.

**Decision:** `app/**/page.tsx` only wires metadata + one view. Types/API/UI live in `features/<domain>/`.

**Consequences:** Clear ownership · harder to “dump” helpers · agents must know [[Frontend Domain Map]].

Related: [[Frontend Architecture]] · [[ADR BFF never exposes access tokens]]
