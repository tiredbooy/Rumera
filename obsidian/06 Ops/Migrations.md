---
tags: [ops]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 06 Ops]]


# Migrations

## Two databases → two trees

| Tree | Directory | When |
|------|-----------|------|
| Main | `apps/backend/migrations/main` | Commerce, users, inventory, outbox, content |
| Analytics | `apps/backend/migrations/analytics` | Events, daily stats, search_summary |

Tool: **goose**. API boot applies migrations (see bootstrap/database helpers).

## Local commands (backend Makefile)

```bash
cd apps/backend
# requires DB_* / ANALYTICS_* env loaded
make migrate-up          # main up
make migrate-down        # main one step down
make migrate-status
make migrate-reset       # destructive — main
make migrate-create name=create_foo

make analytics-up
make analytics-down
```

Integration tests run main migrations against `TEST_DATABASE_URL` (see [[Testing]]).

## Order of operations (new env)

1. Start Postgres main + analytics (+ Redis, etc.) → [[Docker and Local Dev]]
2. Configure env → [[Env and config]]
3. Boot API (migrations apply) **or** run make migrate targets
4. Optional: `make seed` → [[Seed and Demo Data]] (main only, no analytics seed)
5. Optional: async notifications need Kafka + worker migrations already on main (`notification_outbox`)

## Rules

- Never edit applied migration files on shared envs — add a new timestamped file
- Analytics schema changes do not belong in `main/`
- Seed is **not** a migration substitute

## Related

[[Data Stores]] · [[Term goose migration]] · [[ADR Dual databases main and analytics]] · [[Testing]] · [[Makefile map]]

#ops
