---
tags: [backend, account, giftcard]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Gift Card Backend

Admin issue + **list/void** (PR-056a) + customer **purchase** (PH-042a) + redeem (single-use → wallet).

## Package

```text
apps/backend/internal/features/giftcard/
```

| Surface | Path | Notes |
|---------|------|--------|
| Customer | `POST /gift-cards/purchase` | Pending `gbuy-*` + `payment_url` (PR-005a); money mw |
| Customer | `GET /gift-cards/mine` | Codes after paid |
| Customer | `POST /gift-cards/redeem` | Money mw; status natural key |
| Admin | `GET /admin/gift-cards` | Paginated `{results, pagination}`; `gift-cards:issue` |
| Admin | `POST /admin/gift-cards` | Staff issue; no purchase_txid |
| Admin | `POST /admin/gift-cards/:id/void` | Active → `disabled`; redeemed/disabled → `409 INVALID_STATE` |

FE operator list/void is live on `/admin/gift-cards` (PR-064a). Void is not a refund.

Confirm: `gbuy-*` → `FulfillPaidPurchaseTx` (not wallet).  
After a **new** issue, email the code (PR-005b; Dispatcher preferred). Replay does not re-send.  
Wire via `WithMailer` / `WithDispatcher` / `WithPurchaserEmailLookup` (container: PR-020a).  
Migration: `purchase_txid` unique partial index.

Bridge: `apps/backend/docs/architecture/gift-card-purchase.md` · API gift-cards.md

Related: [[Wallet Backend]] · [[Payments Backend]] · [[Journey Account wallet redeem]] · [[Journey Gift card purchase]]

#backend #giftcard
