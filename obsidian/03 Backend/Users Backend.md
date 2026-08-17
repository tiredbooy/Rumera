---
tags:
  - backend
  - users
  - auth
aliases:
  - Customers Backend
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Users Backend

Accounts, self-service profile, and admin customer CRM.

## Package (feature slice)

```text
apps/backend/internal/features/users/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

Mounted from `internal/routes/routes.go`:

- `users.RegisterCustomer` — `PATCH /auth/me`
- `auth.RegisterCustomer` — `POST /auth/me/phone/otp` · `/verify` (PR-040i)
- `users.RegisterAdmin`
  - read (`customers:read` ∨ write ∨ `roles:manage`): roles, list, get, audit
  - write (`customers:write`): create / PATCH / DELETE
  - ban (`customers:ban`): `POST /admin/users/:userID/ban` · `/unban`

## Ban / unban (PR-040e)

- Sets `is_banned` + `banned_at`; ban also bumps `sessions_invalidated_at`
- Auth already rejects `IsBanned` on every request
- Idempotent; self-ban/unban denied; last active admin ban → **409**
- Audit as `user.updated` with `is_banned` before/after (no new audit verb)
- Default staff seed has **write**, not **ban**
- PATCH `/admin/users/:userID` still cannot toggle ban

Role / `is_active` / deactivate stay live `role=admin` ([[RBAC]] PR-040c). Wallet credit is [[Wallet Backend]] (`wallet:credit`).

## Phone change OTP (PR-040i)

Self-service `PATCH /auth/me` **does not persist** a new `phone`. Other profile fields still save; response is **202** with `pending_phone`. Bind happens only after OTP to that new number:

1. `POST /auth/me/phone/otp` `{phone}` → 202 (same login OTP stack, purpose `phone_change`)
2. `POST /auth/me/phone/verify` `{phone,code}` → writes `users.phone`

Admin/staff `PATCH /admin/users/:userID` may still set phone without OTP.

See [[Auth and Sessions]] · API `apps/backend/docs/api/auth.md`

## Related

[[Customers Admin]] · [[RBAC]] · [[Auth and Sessions]] · [[Account Domain]] · [[Backend Domain Map]]

API: `apps/backend/docs/api/users.md`

#backend #users
