---
tags: [backend]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Referrals Backend

## API

- `Get` — get-or-create code + pending/completed counts + reward config
- `Claim` — `200 {claimed:true}` after insert; unknown / self / already-claimed → `400 INVALID_REQUEST` (PR-054a). Never success with `claimed:false`.
- `OnPaidOrder` — complete pending + dual loyalty award

## Config

Reward points come from service construction (env-driven loyalty/referral wiring in bootstrap — see [[Env and config]]).

## Related

[[Referrals]] · [[Loyalty Wallet Gift Cards]] · [[Payments Backend]]

#backend
