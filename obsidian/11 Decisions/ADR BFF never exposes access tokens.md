---
tags: [decision]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: BFF never exposes access tokens

**Status:** accepted

**Decision:** Browser calls same-origin BFF. The Go access JWT lives only on the encrypted Auth.js JWT (httpOnly cookie). The `session()` callback must **not** copy `accessToken` onto the Session object, so `GET /api/auth/session` and `useSession()` cannot leak it to XSS. Server BFF (`/api/store`, `/api/admin`), `apiFetch`, live-account checks, and the edge rotation check read the token with `getToken` (`next-auth/jwt`), not `session.accessToken`.

**Consequences:** XSS cannot steal the bearer from session JSON · refresh must go through Auth.js routes · [[BFF Proxies]] mandatory for authed browser traffic · deleting the session field without `getToken` would break BFF/`apiFetch`.

Related: [[Auth and Sessions]] · [[Term BFF]] · [[Term session]]
