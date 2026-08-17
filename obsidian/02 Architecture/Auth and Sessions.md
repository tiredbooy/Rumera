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
- Self-service phone change: OTP to the **new** number (`POST /auth/me/phone/otp` + `/verify`); `PATCH /auth/me` stages only. Login OTP keys are not reused so a change-code cannot log in as that MSISDN (PR-040i) → [[Users Backend]]
- Per-IP limiter (10/min, Redis + in-memory fallback) on login, register, forgot, OTP, refresh, logout, password validate/reset — not per-email lockout
- Login miss (unknown email / OTP-only) still runs bcrypt against a dummy cost-12 hash so timing matches a wrong-password miss
- Banned accounts (`is_banned`) cannot authenticate; `POST /admin/users/:userID/ban` also bumps `sessions_invalidated_at` ([[Users Backend]])

## Frontend

- next-auth v5 (Auth.js)
- Edge middleware: coarse bounce `/account`, `/admin`
- Layout guards: real session authority
- Silent refresh via Auth.js route responses
- Public session (`useSession` / `GET /api/auth/session`) has role, permissions, error — **not** the Go access JWT
- Go JWT lives only in the encrypted Auth.js httpOnly cookie; server reads it with `getToken`

## BFF

[[BFF Proxies]] attach Bearer from `getToken` server-side so the browser never sees the access token in JS or session JSON.

Related: [[RBAC]] · [[Account Domain]] · [[Admin Console]] · [[Frontend Architecture]]

Bridge: `apps/backend/docs/authentication.md` · `apps/frontend/docs/platform/bff-and-auth.md`

#architecture #auth
