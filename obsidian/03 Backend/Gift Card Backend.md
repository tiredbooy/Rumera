---
tags: [backend, account, giftcard]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Gift Card Backend

Admin issue + customer **purchase** (PH-042a) + redeem (single-use → wallet).

## Package

```text
apps/backend/internal/features/giftcard/
```

| Surface | Path | Notes |
|---------|------|--------|
| Customer | `POST /gift-cards/purchase` | Pending `gbuy-*` payment; money mw |
| Customer | `GET /gift-cards/mine` | Codes after paid |
| Customer | `POST /gift-cards/redeem` | Money mw; status natural key |
| Admin | `POST /admin/gift-cards` | Staff issue; no purchase_txid |

Confirm: `gbuy-*` → `FulfillPaidPurchaseTx` (not wallet).  
Migration: `purchase_txid` unique partial index.

Bridge: `apps/backend/docs/architecture/gift-card-purchase.md` · API gift-cards.md

Related: [[Wallet Backend]] · [[Payments Backend]] · [[Journey Account wallet redeem]] · [[Journey Gift card purchase]]

#backend #giftcard
