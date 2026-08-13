---
tags: [ops, quality]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# Testing

## Commands

| Layer | Command | Where |
|-------|---------|-------|
| Go unit | `go test ./...` or `make test-unit` | `apps/backend` |
| Go integration | `make test-integration` | needs `TEST_DATABASE_URL` (+ Redis when required) |
| Frontend unit | `npm test` / `npx vitest run` | `apps/frontend` |
| Typecheck | `npm exec tsc -- --noEmit` | `apps/frontend` |
| Lint | `npm run lint` | `apps/frontend` |
| Go vet | `go vet ./...` | `apps/backend` |

## Critical pure paths (PH-013c)

Local only — **no CI**:

```bash
cd apps/backend
go test ./pkg/token/ ./internal/middlewares/ ./pkg/middleware/ ./internal/features/payments/ -count=1
```

Covers: JWT guards · RequirePermission · Auth rehydrate · idempotency store · webhook fail→stock release.

## Integration focus

Money/stock-critical: inventory reserve, coupons concurrency, media pipeline, gift cards, products — tag `integration`.

See `apps/backend/tests/integration/README.md` via [[Docs Bridge Backend]].

## Playwright (e2e / a11y)

| Status | Detail |
|--------|--------|
| Dependency | `@playwright/test` in frontend package.json |
| Suite ownership | **Task 062** (Codex) — browser axe/keyboard/lifecycle |
| This vault | Do not invent parallel e2e trees that collide |
| After 062 lands | Add run commands here + link from [[Playbooks MOC]] |

Until then: unit/integration + manual Graph/docs for flows; journeys describe expected behavior.

## Related

[[Docker and Local Dev]] · [[Playbook Debug Oversell]] · [[Inventory]] · [[Agent onboarding]] · [[Docs Bridge Root]] (`../docs/TESTING.md`)

#ops #quality
