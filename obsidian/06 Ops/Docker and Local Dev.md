---
tags:
  - ops
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# Docker and Local Dev

```bash
make env && make dev   # full stack
make seed              # [[Seed and Demo Data]]
```

Compose: frontend, backend, postgres×2, redis, meili, nginx.

Prod frontend (`docker-compose.prod.yml`) requires `AUTH_SECRET` and `AUTH_URL` — Auth.js cannot sign sessions without them. See [[Env and config]] and `docs/DOCKER.md`.

Related: [[Runtime Topology]] · [[Processes and Jobs]] · [[Testing]]

Bridge: `docs/DOCKER.md` · root `README.md`

#ops
