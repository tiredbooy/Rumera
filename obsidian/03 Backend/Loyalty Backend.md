---
tags: [backend, account, loyalty]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Loyalty Backend

Points programme (Cellar Club); redeem to wallet.

**Rules design (PH-040a):** project `apps/backend/docs/architecture/loyalty.md`

## Package (feature slice)

```text
apps/backend/internal/features/loyalty/
  doc.go → routes.go → handler.go → service.go → repository.go → model.go
```

Mounted via `RegisterCustomer` + `RegisterAdmin` from `internal/routes/routes.go`.

| Surface | Path | Notes |
|---------|------|--------|
| Customer | `GET /loyalty` | Balance + tier |
| Customer | `GET /loyalty/transactions` | Paginated `{results, pagination}` · `id` / `ref_*` (PR-003j) |
| Customer | `POST /loyalty/redeem` | Money HTTP middleware (PH-011). **`Idempotency-Key` required** (or body key) |
| Award | service only | Never public free credit |
| Redeem | domain key | `{userID}:idem:{key}` (PR-003g). Missing key → `400` |
| Admin | `GET /admin/loyalty/programme` | DB rates + `enabled` (`config_source: db`, PR-003f) |
| Admin | `PUT /admin/loyalty/programme` | Persist rates/tiers/`enabled` · `customers:write` |
| Admin | `GET /admin/loyalty/members` | Search (`q`, `tier`) · `{results, pagination}` (PR-003d) |
| Admin | `GET /admin/loyalty/members/:userID` | Account · `:userID` = public UUID |
| Admin | `GET /admin/loyalty/members/:userID/transactions` | Paginated ledger with `id` / `ref_*` |
| Admin | `POST /admin/users/:userID/loyalty/adjust` | Grant (+) / clawback (−) · `customers:write` · header + body key (PR-003e) |

## Earn catalogue

| Event | Status | Idempotency |
|-------|--------|-------------|
| Order paid | **live** | `order_paid` / `order` / `{orderID}` |
| Signup | **live** | `signup` / `user` / `{userID}` |
| Referral both sides | **live** | `referral*` / `referral` / `{refID}` |
| Review (verified only) | **live PH-040b** | `review` / `review` / `{reviewID}` |
| Birthday (Asia/Tehran, once/year) | **live PH-040b** | `birthday` / `user` / `{userID}:{YYYY}` + cron |
| Admin adjust | **live PR-003e** | `admin_adjust` / `admin` / `{key}` (`\|actor=` when it fits) |
| Order clawback | **live PR-003i** | `ClawbackOrderEarn` on full `refunded` status (balance only; not lifetime) |

Rates: dedicated `loyalty_programme` + `loyalty_programme_tiers` (PR-003f). Env `LOYALTY_*` seeds the first row only. `enabled=false` skips earn and rejects redeem/adjust with `LOYALTY_DISABLED`. See [[Loyalty Wallet Gift Cards]] · [[Journey Admin loyalty member lookup]].

## Observability (PH-040e)

- Prometheus: `loyalty_award_total{reason,result}`, `loyalty_redeem_total{result}`
- Analytics event schema documented (`loyalty_earned` / `loyalty_redeemed`) — not yet queued

## Related

[[Account Domain]] · [[Wallet Backend]] · [[Payments Backend]] · [[Referrals]] ·  
[[Loyalty Wallet Gift Cards]] · [[Journey Loyalty earn on review]] ·  
[[Journey Loyalty birthday bonus]] · [[Journey Admin loyalty member lookup]] ·  
[[Journey Referral complete on paid order]] ·  
[[ADR Idempotency platform]] · [[Money and stock rules]]

API: `apps/backend/docs/api/loyalty.md`

#backend #loyalty
