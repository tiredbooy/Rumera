---
tags: [ops, architecture]
aliases:
  - nginx
  - Gateway
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# Gateway and nginx

## What it is

Edge reverse proxy for local/prod compose:

- `/*` → [[Frontend App]]
- `/api/v1/*` → [[Backend API]]
- Terminates the public port (often `:80`) on `rumera_network`

Configs: `infra/nginx/nginx.dev.conf` · `nginx.prod.conf`

## Why it matters

- Browser may talk to one origin (cookies, no CORS pain)
- Media/API origins can still split for local FE:3000 / API:8080 → [[Media and Cache FE]]
- Auth cookie paths and proxy headers must stay consistent → [[Playbook Debug Session loop]]

## Edge headers and `server_tokens` (PR-090l)

`/api/v1` and `/media` skip Next `headers()`, so the gateway owns the conservative set on every response (`always`):

- `server_tokens off` — no version leak
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` (no CSP at this layer)
- `Referrer-Policy: strict-origin-when-cross-origin`

No HSTS while the live listener is `:80`. `server_name _` — do not invent a public hostname. The commented 443 block keeps `rumera.example.com` as a placeholder.

## Prod `limit_req` on auth

A small shared zone (`auth`, 10m, 10r/s, burst 20, `nodelay`, status 429) covers:

- `/api/v1/auth/` → backend
- `/api/public/auth/` → Next public BFF (register / OTP / password)

Backend `LoginRateLimit` (10/min) still owns the real login/OTP counters. Dev snippet has **no** `limit_req` so local login is not quota'd.

## Production X-Forwarded-For

Prod nginx (`infra/nginx/nginx.prod.conf`) **resets** `X-Forwarded-For` to `$remote_addr` (the TCP peer at the gateway). It does **not** use `$proxy_add_x_forwarded_for`, which would preserve a caller-supplied header.

The backend then trusts only `TRUSTED_PROXIES` (compose: `172.16.0.0/12`, the Docker user-defined bridge that nginx sits on). Together this means `c.ClientIP()` — the key for login/OTP/global rate limits — is the real client at the edge, not an attacker-chosen address.

`X-Real-IP`, `Host`, `X-Forwarded-Proto`, and `X-Forwarded-Host` stay as-is. Do not set `TRUSTED_PROXIES=0.0.0.0/0`. Empty `TRUSTED_PROXIES` fails production boot (`Config.Validate()`). See [[Env and config]] · [[ADR Security posture baseline]].

## Related

[[Runtime Topology]] · [[Docker and Local Dev]] · [[Request Paths]] · [[BFF Proxies]] · [[Docs Bridge Root]]

Bridge: `../docs/DOCKER.md`

#ops
