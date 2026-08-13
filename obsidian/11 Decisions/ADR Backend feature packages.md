---
tags: [decision, backend, architecture]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 11 Decisions]]


# ADR: Backend feature packages

**Status:** accepted · **migration complete (Phase 2)**  
**Date:** 2026-08-10 · **Supersedes in-progress note:** 2026-08-11

## Context

The Go API was organised by technical layer (`handlers/` · `services/` · `repositories/` · `models/`). At ~220 routes that made ownership hard: every domain change spanned four directories and a god `Handler`.

## Decision

Use **feature-based vertical slices** under `internal/features/<domain>/`, each owning model + repository + service + handler + **routes** + **wire**.

**Route composition:**

```text
features/<name>/routes.go     → RegisterPublic / RegisterCustomer / RegisterAdmin
internal/routes/routes.go     → single composer (trust groups + Register* only)
```

`legacy.go` **removed** after full migration. Empty layered packages removed.

**Packaging choices:**

| Domain group | Layout |
|--------------|--------|
| Catalogue | Umbrella `features/catalog/{product,variant,option,category,brand,tag}` |
| Account extras | Flat packages (`wallet`, `wishlist`, `loyalty`, …) |
| HTTP helpers | `internal/platform/httpx` |
| Shared models | `internal/models` (errors, filters, patch, shared product wire DTOs) |

**Non-goals:** no microservice split, no HTTP/JSON contract changes during move.

## Outcome

All business HTTP domains live under `features/`. Composition root is slim `handlers.Deps`. See [[Layered Backend]] · [[Backend package map]] · repo `architecture/domain-map.md`.
| Orders | `internal/features/orders` |
| Media | `internal/features/media` |
| Taste Profile | `internal/features/taste` |
| Product Alerts | `internal/features/alerts` |
| Subscriptions | `internal/features/subscription` |
| Gift Card | `internal/features/giftcard` |
| Referral | `internal/features/referral` |
| Loyalty | `internal/features/loyalty` |

## Consequences

- Open one folder to understand a domain end-to-end.
- Main router stays a short composition list — easy to scan.
- Cross-feature deps must be downward (e.g. orders → addresses).
- Until migration finishes, `legacy.go` still holds many god-handler routes.

## How to migrate the next domain

1. Move files into `features/<name>/`.
2. Add `routes.go` with `Register*`.
3. Call it from `routes.go` composer; delete block from `legacy.go`.
4. `go build ./...` + `go test ./internal/...`.
5. Update [[Backend package map]] · [[Backend Domain Map]] · `apps/backend/docs/architecture/domain-map.md`.

Related: [[Layered Backend]] · [[Backend package map]] · [[Backend Domain Map]] · [[Backend API]] · [[ADR Thin routes and domain features]] (frontend twin)

Workstream: `refactor-workstreams/backend-feature-architecture/`

#decision #backend #architecture
