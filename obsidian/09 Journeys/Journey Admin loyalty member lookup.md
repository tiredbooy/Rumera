---
tags: [journey, admin, loyalty]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Admin loyalty member lookup

**Status:** live (PR-003d reads + PR-003e adjust + PR-003b operator UI + PR-003f programme persist).

## Actor

Staff with `customers:read` (lookup) / `customers:write` (adjust)

## Happy path

1. Open `/admin/loyalty` (باشگاه مشتریان). Programme snapshot stays at the top (`GET /admin/loyalty/programme` includes `enabled`; `config_source` is `db` after seed). Staff with `customers:write` can `PUT /admin/loyalty/programme` to change rates, the four tier minima, or disable the programme. Members are below.
2. Search members: `GET /admin/loyalty/members?q=&tier=&page=&limit=`
3. Envelope is `{results, pagination}` (same as admin users, not `{data:[]}`)
4. Row `user_id` is the public UUID — same as `/admin/customers/:id`
5. Open `/admin/loyalty/:userID`: `GET /admin/loyalty/members/:userID` → balance, lifetime, tier
6. Open ledger: `GET /admin/loyalty/members/:userID/transactions` (paged; includes `id`, `ref_type`, `ref_id`)
7. Grant or clawback (only with `customers:write`): `POST /admin/users/:userID/loyalty/adjust` with `delta` ≠ 0, `note`, and `Idempotency-Key` / `idempotency_key`. First apply **201**; same key **200**. Clawback does not reduce lifetime. Form mirrors [[Admin Console]] wallet credit.

## Failure branches

- Unknown UUID → `404 USER_NOT_FOUND` → admin `notFound()`
- Bad path UUID → `400 INVALID_PARAMS` / FE `parseAdminUserID` → `notFound()`
- Known user with no `loyalty_accounts` row → zero bronze standing (not 404)
- `delta` 0 → `422` (form disables submit)
- Missing `customers:write` on adjust → form hidden; API still `403`
- Programme / list / ledger fetch failure → retry card, no invented rows
- `enabled=false` → automated earn skips; redeem / adjust return `LOYALTY_DISABLED` (reads still work)
- PUT programme validation (divisor ≤ 0, bronze ≠ 0, non-increasing tiers, bad IANA tz) → `422`

## Related

[[Loyalty Backend]] · [[Loyalty Wallet Gift Cards]] · [[Customers Admin]] · [[Admin Console]] · [[Journeys MOC]]

#journey
