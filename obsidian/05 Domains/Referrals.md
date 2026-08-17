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
| Unknown / blank code | `400 INVALID_REQUEST` (PR-054a) |
| Self-referral | `400 INVALID_REQUEST` |
| Already referred | `400 INVALID_REQUEST` |
| Valid claim | `200 {claimed: true}` + pending row with reward points |
| First paid order | Award referrer + referee (idempotent per referral id) **then** Complete |

Award goes through [[Loyalty Wallet Gift Cards|LoyaltyService.Award]] with reason keys `referral` / `referral_welcome`.

Triggered from [[Payments Backend]] `Confirm` → `referral.OnPaidOrder` (retried with the earn intent; Award errors are not swallowed — payment still does not roll back).

## Code map

| Layer | Path |
|-------|------|
| Feature slice | `apps/backend/internal/features/referral/` |
| FE | `apps/frontend/features/referral/` · often surfaced in rewards UI |
| Wire | `GET referrals/me` · `POST referrals/claim` (`claimed:true` or 400) |

## Related

[[Loyalty Wallet Gift Cards]] · [[Payments]] · [[Account Domain]] · [[Journey Referral complete on paid order]] · [[Business Domains MOC]]

#domain
