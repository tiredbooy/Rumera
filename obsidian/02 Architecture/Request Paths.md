---
tags:
  - architecture
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Request Paths

Three doors into the system.

## 1. Public storefront (RSC)

```text
Browser GET /products/…
  → [[Frontend App]] Server Component
  → feature public API
  → publicRequest → [[Backend API]] /api/v1
```

No customer token. Cache tags → [[Media and Cache FE]].

## 2. Authenticated browser (BFF)

```text
Client island
  → storeRequest / admin client
  → [[BFF Proxies]] /api/store|admin
  → Bearer from Auth.js session
  → [[Backend API]]
```

Token never in browser JS → [[Auth and Sessions]].

## 3. Direct API clients

```text
Authorization: Bearer … → /api/v1/*
```

Same contracts as BFF path.

Related: [[Frontend Architecture]] · [[Layered Backend]] · [[System Atlas]]

#architecture
