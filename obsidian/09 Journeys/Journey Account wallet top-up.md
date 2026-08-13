---
tags: [journey, account, money]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Account wallet top-up (gateway)

**Status:** live API PH-041a + storefront PH-041b

## Happy path

1. Customer opens `/account/wallet` → presets / custom amount
2. `POST /wallet/topup` + `Idempotency-Key` → pending payment `wtop-…`
3. UI pending panel (copy tx id); pay gateway with `transaction_id`
4. Webhook `succeeded` → Confirm credits wallet (`topup_txid=` ledger)
5. Customer refreshes balance / ledger

## Failure branches

- Amount out of bounds → 422
- Webhook failed → no credit
- Double webhook → terminal ACK / deposit marker no-op

## Related

[[Wallet Backend]] · [[Payments Backend]] · [[Journey Account wallet redeem]] · [[Money and stock rules]]

#journey
