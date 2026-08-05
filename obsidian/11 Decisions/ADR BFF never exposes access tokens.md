---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: BFF never exposes access tokens

**Status:** accepted

**Decision:** Browser calls same-origin BFF; Auth.js session holds tokens server-side.

**Consequences:** XSS cannot steal bearer easily · refresh must go through Auth.js routes · [[BFF Proxies]] mandatory for authed browser traffic.

Related: [[Auth and Sessions]] · [[Term BFF]] · [[Term session]]
