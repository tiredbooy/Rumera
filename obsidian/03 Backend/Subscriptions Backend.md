---
tags: [backend, account, subscription]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Subscriptions Backend

Physical **cellar box** subscriptions (e-com box model) + email renewal cron.

**Not:** streaming entitlements, unlimited catalog access, SaaS seats.

## Package (feature slice)

```text
apps/backend/internal/features/subscription/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

| Piece | Role |
|-------|------|
| `model.go` | Cadence/status/actions, `PlanCellarBox`, `NextRenewal`, `AllowedAction` |
| `service.go` | Create (plan forced), List, Update with lifecycle guards |
| `repository.go` | CRUD-ish + `FindDue` / `AdvanceRenewal` for cron |
| Routes | Customer only: `GET/POST /subscriptions`, `PATCH /:id` |

Mounted via `RegisterCustomer` from `internal/routes/routes.go`.  
`RegisterAdmin` is empty (no staff subscription API yet).

## Cron

`internal/corn/subscription_renewal_job.go` — due active → email → advance date.
**No charge.** See [[Processes and Jobs]].

## Project docs

- `apps/backend/docs/architecture/box-subscriptions.md` (PH-043a)
- `apps/backend/docs/api/subscriptions.md`

## Related

[[Subscriptions]] · [[Account Domain]] · [[ADR Backend feature packages]] ·
[[Backend package map]] · [[Journey Subscription renewal email]] ·
[[Journey Manage cellar box]] · [[Loyalty Wallet Gift Cards]]

#backend #subscription
