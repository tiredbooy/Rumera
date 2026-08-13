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

🔒 List the caller’s subscriptions (newest first). Unbounded list today
(follow-up: LIMIT).

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
| `address_id` | no | `min=1` if present; JSON `null` / omit → no address |

**Behaviour:**

- `plan` forced to `cellar-box`
- `status` starts `active`
- `next_renewal_at` = now + one cadence
- **No payment** is taken at create

**Response:** `201` `{ "data": Subscription }`

**Idempotency:** catalogue P1 in [idempotency.md](../architecture/idempotency.md)
(`POST /subscriptions`). Prefer `Idempotency-Key` when clients retry create.

---

## `PATCH /subscriptions/:id`

🔒 Lifecycle action on a subscription owned by the caller.

**Body:**

```json
{ "action": "pause" }
```

| `action` | Allowed when | Effect |
|----------|--------------|--------|
| `pause` | `active` | → `paused` |
| `resume` | `paused` or `cancelled` | → `active` |
| `cancel` | `active` or `paused` | → `cancelled` |
| `skip` | `active` | Advance `next_renewal_at` by one cadence |

**Errors:**

| Situation | Code |
|-----------|------|
| Not found / not owned | `NOT_FOUND` |
| Action not allowed for current status | `INVALID_REQUEST` |
| Validation (bad action enum) | `VALIDATION_ERROR` |

**Response:** `200` `{ "data": Subscription }`

---

## Admin

No admin subscription routes today.

---

## Renewal (not an HTTP API)

Cron job emails due active subscribers and advances `next_renewal_at`.
See architecture doc — **no charge**.
