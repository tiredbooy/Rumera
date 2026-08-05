---
tags: [architecture, api]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Error model

## Backend

- Services return `*apperr.AppError` (or domain sentinels mapped at edge)
- Envelope: `{ "error": { "code", "message", "fields?" } }`
- Business stock short → insufficient stock (HTTP conflict-ish mapping)
- Webhook bad HMAC → 401; missing secret → 503

## Frontend

- `lib/api/error-semantics` — typed 404 vs hard fail
- Public detail: `null` on 404; other errors bubble to boundaries
- Soft-fail allowed on home/SEO SSG, **not** on money paths

Related: [[Wire contracts]] · [[Term envelope]] · [[Request Paths]] · [[Pitfalls and anti-patterns]]

Bridge: `apps/backend/docs/conventions.md`

#architecture
