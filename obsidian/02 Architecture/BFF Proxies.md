---
tags:
  - architecture
  - frontend
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# BFF Proxies

Next.js route handlers under `app/api/`:

| Path | Use |
|------|-----|
| `/api/public/*` | Unauth forms (register, OTP, …) |
| `/api/store/*` | Customer session → API |
| `/api/admin/*` | Staff session + live admin check |
| `/api/auth/*` | Auth.js |

Browser clients call **same origin** only (`storeRequest`, domain admin clients).

Related: [[Request Paths]] · [[Auth and Sessions]] · [[Frontend App]] · [[Platform Layer]]

Bridge: `apps/frontend/docs/platform/bff-and-auth.md` · `api-layer.md`

#architecture #frontend
