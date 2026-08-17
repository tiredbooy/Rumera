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
- **PR-040c model B:** `customers:write` is profile create/edit only. Role / `is_active` / deactivate require live `role=admin` (`liveAdminActor` + service). Wallet credit is **`wallet:credit`**, not in the default staff seed — staff cannot mint ledger money with the write grant.
- **PR-040e / PR-064b:** `POST /admin/users/:userID/ban` · `/unban` behind **`customers:ban`** only (not OR'd onto write). Default staff seed has write, not ban. FE detail confirm UI hides without the cap and never self-bans. Sets `is_banned` / `banned_at`; auth already honors `IsBanned`. See [[Users Backend]] · [[Customers Admin]].
- Matrix + playbook: repo `apps/backend/docs/architecture/rbac.md`
- Examples: `inventory:read` vs `inventory:write` → [[Inventory FE]]
- Product editor: `products:read` may **view** `/admin/products/[id]`; save / upload / variant mutate need `products:write` ([[Journey Admin publish product]])
- Journal detail: `journal:read` may **view** `/admin/journal/[id]`; save / cover upload need `journal:write`. Options list: `products:read` may **view** `/admin/options`; create / edit / delete need `products:write` (PR-061e). See [[Admin Console]]
- Tags / coupons / shipping pages use `requirePermission` (`tags:manage`, `coupons:manage`, `shipping:manage`) — staff with the grant is allowed; `role === "admin"` is not the page gate (PR-061a). See [[Admin Console]] · [[Playbook Add admin module]]

Customer account nav is separate (`ACCOUNT_NAV`) → [[Account FE]].

Related: [[Auth and Sessions]] · [[Admin Console]] · [[Backend API]] · [[Playbook Document a change]]

Bridge: `apps/frontend/docs/platform/rbac.md` · `apps/backend/docs/architecture/rbac.md`

#architecture #auth
