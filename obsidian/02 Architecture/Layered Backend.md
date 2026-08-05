---
tags:
  - architecture
  - backend
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Layered Backend

```text
routes → middlewares → handlers → services → repositories → DB
                         ↘ mappers (DTO)
```

Rules:

- Handlers: bind HTTP only — no SQL
- Services: business rules — no `gin.Context`
- Repositories: SQL only
- Errors: `apperr` → response envelope

DI once in `internal/bootstrap/container.go`.

Related: [[Backend API]] · [[Backend Domain Map]] · [[Auth and Sessions]] · [[Inventory Backend]] · [[Payments Backend]]

Bridge: `apps/backend/docs/architecture.md`

#architecture #backend
