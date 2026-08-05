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

## Related

[[Runtime Topology]] · [[Docker and Local Dev]] · [[Request Paths]] · [[BFF Proxies]] · [[Docs Bridge Root]]

Bridge: `../docs/DOCKER.md`

#ops
