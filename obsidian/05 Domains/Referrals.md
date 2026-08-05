---
tags: [domain]
aliases:
  - Referral program
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 05 Domains]]


# Referrals

## What it is

Share-a-code growth loop:

1. Referrer has a **code** (created on first `GET` of referral profile).
2. Referee **claims** a code (authenticated).
3. On referee’s **first paid order**, referral **completes** and both sides may get **loyalty points**.

## Rules

| Case | Behavior |
|------|----------|
| Unknown code | Claim is silent no-op |
| Self-referral | No-op |
| Already referred | No-op |
| Valid claim | Pending referral row with reward points |
| First paid order | Complete + award referrer + referee (idempotent) |

Award goes through [[Loyalty Wallet Gift Cards|LoyaltyService.Award]] with reason keys `referral` / `referral_welcome`.

Triggered from [[Payments Backend]] `Confirm` → `referral.OnPaidOrder` (best-effort).

## Code map

| Layer | Path |
|-------|------|
| Service | `internal/services/referral_svc.go` |
| FE | `features/referral/` · often surfaced in rewards UI |
| Wire | `GET referrals/me` · `POST referrals/claim` |

## Related

[[Loyalty Wallet Gift Cards]] · [[Payments]] · [[Account Domain]] · [[Journey Referral complete on paid order]] · [[Business Domains MOC]]

#domain
