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

Mounted via `RegisterCustomer` from `internal/routes/routes.go`.

| Surface | Path | Notes |
|---------|------|--------|
| Customer | `GET /loyalty`, `GET /loyalty/transactions` | Read |
| Customer | `POST /loyalty/redeem` | Money HTTP middleware (PH-011). Prefer `Idempotency-Key`; domain spend key residual → PH-040b |
| Award | service only | Never public free credit |
| Redeem | domain key | `Idempotency-Key` → ledger `idem:{key}` (PH-040b) |
| Admin | `GET /admin/loyalty/programme` | Env rates snapshot, read-only (PH-040d) |

## Earn catalogue

| Event | Status | Idempotency |
|-------|--------|-------------|
| Order paid | **live** | `order_paid` / `order` / `{orderID}` |
| Signup | **live** | `signup` / `user` / `{userID}` |
| Referral both sides | **live** | `referral*` / `referral` / `{refID}` |
| Review (verified only) | **live PH-040b** | `review` / `review` / `{reviewID}` |
| Birthday (Asia/Tehran, once/year) | **live PH-040b** | `birthday` / `user` / `{userID}:{YYYY}` + cron |
| Admin adjust | **PH-040d** | `admin_adjust` / `admin` / `{key}` |
| Order clawback | helper ready | `ClawbackOrderEarn` — wire with refund saga |

Rates: env `LOYALTY_*` (incl. review/birthday); admin read-only programme UI PH-040d.

## Observability (PH-040e)

- Prometheus: `loyalty_award_total{reason,result}`, `loyalty_redeem_total{result}`
- Analytics event schema documented (`loyalty_earned` / `loyalty_redeemed`) — not yet queued

## Related

[[Account Domain]] · [[Wallet Backend]] · [[Payments Backend]] · [[Referrals]] ·  
[[Loyalty Wallet Gift Cards]] · [[Journey Loyalty earn on review]] ·  
[[Journey Loyalty birthday bonus]] · [[Journey Referral complete on paid order]] ·  
[[ADR Idempotency platform]] · [[Money and stock rules]]

API: `apps/backend/docs/api/loyalty.md`

#backend #loyalty
