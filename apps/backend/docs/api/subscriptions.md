# Subscriptions API (cellar box)

🔒 Customer (authenticated)  
**Product model:** [architecture/box-subscriptions.md](../architecture/box-subscriptions.md) (PH-043a)

Recurring **physical box** membership — not streaming or SaaS seats.

Base: `/api/v1`

---

## Resource shape

```json
{
  "id": 1,
  "plan": "cellar-box",
  "cadence": "monthly",
  "status": "active",
  "address_id": 12,
  "next_renewal_at": "2026-09-12T10:00:00Z",
  "created_at": "2026-08-12T10:00:00Z"
}
```

| Field | Type | Notes |
|-------|------|--------|
| `id` | int64 | Subscription id |
| `plan` | string | Always `cellar-box` on create |
| `cadence` | string | `monthly` \| `quarterly` |
| `status` | string | `active` \| `paused` \| `cancelled` |
| `address_id` | int64? | Omitted when null |
| `next_renewal_at` | RFC3339 | Next box window |
| `created_at` | RFC3339 | |

There is **no** `contents`, `items`, `price`, or entitlement field on the wire.

---

## `GET /subscriptions`

🔒 List the caller’s subscriptions (newest first). Capped at 100 rows.

**Response:** `{ "data": [ Subscription, ... ] }`

---

## `POST /subscriptions`

🔒 Create an active cellar-box subscription.

**Body:**

```json
{
  "cadence": "monthly",
  "address_id": 12
}
```

| Field | Required | Rules |
|-------|----------|--------|
| `cadence` | yes | `monthly` \| `quarterly` |
| `address_id` | no | `min=1` if present; JSON `null` / omit → no address. Must be an address **owned by the caller** (same as checkout). |

**Behaviour:**

- `plan` forced to `cellar-box`
- `status` starts `active`
- `next_renewal_at` = now + one cadence
- **No payment** is taken at create
- `address_id` is resolved with `addresses.GetByID(id, userID)` before insert
- At most **one** `status=active` cellar-box per customer (PR-057b). A second
  create while one is already active is `409 CONFLICT`. Paused / cancelled
  rows do not occupy the slot.

**Errors:**

| Situation | Code |
|-----------|------|
| Caller already has an active cellar-box | `CONFLICT` |
| `address_id` missing or owned by another user | `NOT_FOUND` |
| Validation (bad cadence, `address_id < 1`) | `VALIDATION_ERROR` |

**Response:** `201` `{ "data": Subscription }`

**Idempotency:** catalogue P1 in [idempotency.md](../architecture/idempotency.md)
(`POST /subscriptions`). Prefer `Idempotency-Key` when clients retry create.

---

## `PATCH /subscriptions/:id`

🔒 Lifecycle action and/or ship-to change on a subscription owned by the caller.
`action` is required only for a lifecycle change. `address_id` may be sent
alone or together with `action`.

**Body** (at least one field):

```json
{ "action": "pause", "address_id": 12 }
```

Address-only (no status / renewal change):

```json
{ "address_id": 12 }
```

| Field | Required | Rules |
|-------|----------|--------|
| `action` | no | `pause` \| `resume` \| `cancel` \| `skip`. Omit for ship-to only. |
| `address_id` | no | `min=1` if present. Must belong to the caller. Omitted / JSON `null` → ship-to unchanged. Does **not** clear the address. |

| `action` | Allowed when | Effect |
|----------|--------------|--------|
| `pause` | `active` | → `paused` |
| `resume` | `paused` or `cancelled` | → `active`. `409 CONFLICT` if another row is already active (PR-057b) |
| `cancel` | `active` or `paused` | → `cancelled` |
| `skip` | `active` | Advance `next_renewal_at` by one cadence |

**Ship-to (`address_id`):**

- Persisted on the subscription row. Response already includes `address_id`.
- Allowed on any status, including **active**. No payment, charge, or renewal side-effect.
- Combined with `action`: lifecycle is applied first, then ship-to.
- Address-book **ownership** is required: `addresses.GetByID(id, userID)` before persist (same as create / checkout). Missing or other-user id → `NOT_FOUND`. PATCH also rejects `address_id < 1` and unknown FK ids.

**Errors:**

| Situation | Code |
|-----------|------|
| Not found / not owned (subscription **or** `address_id`) | `NOT_FOUND` |
| Resume would create a second active cellar-box | `CONFLICT` |
| Action not allowed for current status | `INVALID_REQUEST` |
| Empty body (no `action` and no `address_id`) | `INVALID_REQUEST` |
| Validation (bad action enum, `address_id < 1`) | `VALIDATION_ERROR` |
| `address_id` fails addresses FK | `INVALID_REQUEST` |

**Response:** `200` `{ "data": Subscription }`

**Not this endpoint:** box auto-charge (PH-043c closed). No Netflix-style entitlements.

---

## Admin

No admin subscription routes today.

---

## Renewal (not an HTTP API)

Cron job emails due active subscribers (via `notifications.Dispatcher` when
wired, else inline mailer) and advances `next_renewal_at` **only after the
reminder is dispatched/sent** (PR-057a / PR-055a). Unset dispatcher+mailer or
send failure leaves the row due for the next tick. See architecture doc —
**no charge**.
