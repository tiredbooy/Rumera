# Referrals

**Implementation (feature slice):** `internal/features/referral/`  
(handler · service · repository · model · `routes.go` → `RegisterCustomer`).  
Composed from `internal/routes/routes.go`.

Share-a-code: a customer gets a code on first `GET /referrals/me`. A referee
claims it with `POST /referrals/claim`. Both sides earn loyalty points on the
referee’s first **paid** order (`referral.OnPaidOrder` after Confirm).

See [Authentication](../authentication.md) and [Conventions](../conventions.md).
Earn rules: [architecture/loyalty.md](../architecture/loyalty.md).

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/referrals/me` | 🔒 customer | Code + pending/completed counts + reward |
| POST | `/referrals/claim` | 🔒 customer | Attach a code as referee |

---

## Get my referral standing

```
GET /referrals/me
Authorization: Bearer <access_token>
```

Creates a code on first request if the caller has none.

**Response** `200 OK` — `ReferralResponse`:

```json
{
  "data": {
    "code": "RUMERA24",
    "pending": 2,
    "completed": 3,
    "reward": 300
  }
}
```

`reward` is the points each side earns when a pending referral completes.

**Errors:** `401 UNAUTHORIZED`.

---

## Claim a referral code (PR-054a)

```
POST /referrals/claim
Authorization: Bearer <access_token>
```

**Request body** — `ClaimReferralInput`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `code` | string | ✓ | non-empty (trimmed, matched case-insensitively) |

**Response** `200 OK` — only after a new pending referral row is created:

```json
{
  "data": {
    "claimed": true
  }
}
```

Success never returns `claimed: false`. The following are **`400 INVALID_REQUEST`**:

- unknown / blank code
- self-referral (caller owns the code)
- already claimed (this user already has a referral edge)
- insert race (`ON CONFLICT DO NOTHING` → 0 rows)

**Errors:** `401 UNAUTHORIZED` · `400 INVALID_REQUEST` · `422` missing `code`.

Points are **not** granted here. Completion + dual award runs on first paid
order (`OnPaidOrder` awards both sides, then completes).
