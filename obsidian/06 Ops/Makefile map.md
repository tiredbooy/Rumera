---
tags: [ops, code]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# Makefile map

Common targets from monorepo / backend Makefiles (see files for full list).

| Target | Role |
|--------|------|
| `make env` | Copy env templates |
| `make dev` | Compose watch stack → [[Docker and Local Dev]] |
| `make seed` | [[Seed and Demo Data]] |
| `make health` | Health checks (if defined) |
| Backend `make test-unit` / `test-integration` | [[Testing]] |
| Backend `migrate-up` / `analytics-up` | [[Migrations]] |

Always confirm against root `Makefile` and `apps/backend/Makefile` — names can evolve.

## Related

[[Docker and Local Dev]] · [[Testing]] · [[Env and config]] · [[Code Maps MOC]] · [[Known gaps]]

#ops
