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
  doc.go → routes.go → handler.go → service.go → renewal.go → repository.go → model.go
```

| Piece | Role |
|-------|------|
| `model.go` | Cadence/status/actions, `PlanCellarBox`, `NextRenewal`, `AllowedAction` |
| `service.go` | Create (plan forced; one active → 409), List (`LIMIT 100`), Update (lifecycle and/or `address_id`) |
| `renewal.go` | `ProcessDueRenewals` — email then advance only after dispatch/send (PR-057a / PR-055a) |
| `repository.go` | CRUD-ish + `UpdateAddress` + `FindDue` / `AdvanceRenewal` for cron |
| Routes | Customer only: `GET/POST /subscriptions`, `PATCH /:id` |

`PATCH` body may be `{action}`, `{address_id}`, or both. Address-only skips
the status machine. No payment side-effect. `address_id` on **create and
PATCH** must belong to the caller (`addresses.GetByID(id, userID)`, same as
checkout) — missing / other-user → `NOT_FOUND`. See [[Addresses Backend]].

**One active box (PR-057b):** service scans the caller’s rows for
`status=active`. Second `POST /subscriptions` (or `resume` that would
make two actives) → `CONFLICT` (409). Paused / cancelled do not occupy
the slot.
Storefront picker is live (PR-035b) — [[Playbook Change cellar box address]] ·
[[Journey Manage cellar box]].

Mounted via `RegisterCustomer` from `internal/routes/routes.go`.  
`RegisterAdmin` is empty (no staff subscription API yet).

## Cron

`internal/corn/subscription_renewal_job.go` → `subscription.ProcessDueRenewals` —
due active → `Dispatcher.DispatchSubscriptionRenewal` (or inline mailer) →
advance date **only after dispatch/send succeeds** (PR-057a / PR-055a).
Unset dispatcher+mailer / send error leaves the row due. **No charge.** See [[Processes and Jobs]].

## Project docs

- `apps/backend/docs/architecture/box-subscriptions.md` (PH-043a)
- `apps/backend/docs/api/subscriptions.md`

## Related

[[Subscriptions]] · [[Account Domain]] · [[ADR Backend feature packages]] ·
[[Backend package map]] · [[Journey Subscription renewal email]] ·
[[Journey Manage cellar box]] · [[Playbook Debug Subscription renewal email]] ·
[[Loyalty Wallet Gift Cards]]

#backend #subscription
