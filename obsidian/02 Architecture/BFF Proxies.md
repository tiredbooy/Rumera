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
| `/api/store/*` | Customer session → API (`payments` first-segment allow-listed for start/status; **not** `/admin/payments`) |
| `/api/admin/*` | Staff session + live admin check |
| `/api/auth/*` | Auth.js |

Browser clients call **same origin** only (`storeRequest`, domain admin clients).

Store and admin proxies forward incoming `Idempotency-Key` when present
(`lib/api/forward-headers.ts`). They do not invent a key. Go CORS
`Allow-Headers` includes `Idempotency-Key` so a browser-direct call from
an allowed origin can pass preflight ([[ADR Idempotency platform]]). See
[[Playbook Debug Idempotency]] · [[Loyalty Wallet Gift Cards]].

Store proxy also copies incoming analytics `sid`/`did` cookies upstream and
matching `Set-Cookie` back (cookie names only; no invented IDs). See
[[Analytics]].

Related: [[Request Paths]] · [[Auth and Sessions]] · [[Frontend App]] · [[Platform Layer]]

Bridge: `apps/frontend/docs/platform/bff-and-auth.md` · `api-layer.md`

#architecture #frontend
