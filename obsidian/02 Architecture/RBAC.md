---
tags:
  - architecture
  - auth
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# RBAC

Staff permissions for [[Admin Console]].

- Frontend: `lib/rbac/{permissions,roles,can,nav}.ts`
- Nav filtered with `can()` — **UI only**
- Backend: JWT role + permission checks — **real gate**
- Examples: `inventory:read` / `inventory:write` → [[Inventory FE]]

Customer account nav is separate (`ACCOUNT_NAV`) → [[Account FE]].

Related: [[Auth and Sessions]] · [[Admin Console]] · [[Backend API]]

Bridge: `apps/frontend/docs/platform/rbac.md`

#architecture #auth
