---
tags:
  - architecture
  - auth
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# RBAC

Staff permissions for [[Admin Console]].

- Panel roles: **`admin`** (superuser) · **`staff`** (capability grants)
- Frontend: `lib/rbac/{permissions,roles,can,nav}.ts` — nav `can()` is **UI only**
- Backend: Auth + role + `RequirePermission` — **real gate**
- **PH-021a:** write routes require write/moderate/delete — not `*:read` alone
- **PH-021b:** last-admin lockout (409); self-demotion denied; mid-session revoke = next request 403
- Matrix + playbook: repo `apps/backend/docs/architecture/rbac.md`
- Examples: `inventory:read` vs `inventory:write` → [[Inventory FE]]

Customer account nav is separate (`ACCOUNT_NAV`) → [[Account FE]].

Related: [[Auth and Sessions]] · [[Admin Console]] · [[Backend API]] · [[Playbook Document a change]]

Bridge: `apps/frontend/docs/platform/rbac.md` · `apps/backend/docs/architecture/rbac.md`

#architecture #auth
