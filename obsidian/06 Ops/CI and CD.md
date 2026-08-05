---
tags: [ops]
aliases:
  - CI/CD
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# CI and CD

## Current state

No first-class GitHub Actions (or similar) pipeline was vaulted as a hard dependency of local dev. Shipping today is primarily:

- Docker Compose dev/prod files → [[Docker and Local Dev]] · [[Gateway and nginx]]
- Manual/make-driven migrate, seed, test

## When CI is added

Recommended gates (align with [[Testing]]):

1. `go test ./...` + `go vet`
2. Frontend `tsc` + `vitest` + lint
3. Optional integration job with service containers
4. After 062: Playwright smoke in CI
5. Never commit secrets; use env from [[Env and config]]

## Related

[[Testing]] · [[Makefile map]] · [[Known gaps]] · [[Playbook Incident first response]]

#ops
