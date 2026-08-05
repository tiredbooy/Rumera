---
tags:
  - architecture
  - auth
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Auth and Sessions

## Backend

- JWT access + refresh (`pkg/token`)
- JWT carries int `uid` + public UUID `user_id`
- Groups: public · customer Auth · admin Auth + role
- OTP / password reset → [[Notifications]]

## Frontend

- next-auth v5 (Auth.js)
- Edge middleware: coarse bounce `/account`, `/admin`
- Layout guards: real session authority
- Silent refresh via Auth.js route responses

## BFF

[[BFF Proxies]] attach Bearer server-side so browser never stores access token in JS.

Related: [[RBAC]] · [[Account Domain]] · [[Admin Console]] · [[Frontend Architecture]]

Bridge: `apps/backend/docs/authentication.md` · `apps/frontend/docs/platform/bff-and-auth.md`

#architecture #auth
