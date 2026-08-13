# Storefront gift cards

**Who this is for:** FE engineers changing purchase, mine list, or redeem UX.

**Backend:** [gift-cards API](../../../backend/docs/api/gift-cards.md) ·
[gift-card purchase architecture](../../../backend/docs/architecture/gift-card-purchase.md)

---

## Surfaces

| Surface | Path |
|---------|------|
| Account wallet | `/account/wallet` → `wallet-view.tsx` |
| Purchase (gateway) | `features/gift-cards/gift-card-purchase.tsx` (PH-042b) |
| My codes (self-delivery) | `features/gift-cards/gift-card-mine.tsx` |
| Redeem → wallet | `features/wallet/gift-card-redeem.tsx` |
| Admin issue | `/admin/gift-cards` (staff only) |

## Purchase UX (PH-042b)

1. Customer picks a **preset** or custom amount (10 000 … 50 000 000 IRT).
2. `POST /gift-cards/purchase` with `Idempotency-Key` → **pending** intent (`gbuy-…`).
3. UI shows pending state (copy tx id). **No code yet.**
4. After gateway payment + webhook, customer taps **بروزرسانی کارت‌ها** →
   `GET /gift-cards/mine` shows `code` + face amount + status.
5. Self-use: paste code into redeem, **or** copy/send code as a gift.

**Not free money:** no code without paid `gbuy-…` settlement. Staff issue is separate.

## Redeem polish

- Single-use: full `initial_amount` credits wallet once.
- Sends `Idempotency-Key`; card status is the domain natural key.
- No partial balance API — “balance check” in UI = show face amount on mine list
  and honest copy that redeem is all-or-nothing.

## API client

| Call | Module |
|------|--------|
| `purchaseGiftCard` · `listMyGiftCards` · `redeemGiftCard` | `features/gift-cards/api/account.ts` |
| Hooks | `usePurchaseGiftCard` · `useMyGiftCards` · `useRedeemGiftCard` |

## Related

- Wallet top-up: `docs/features/wallet.md`
- Account tour: `docs/features/account-tour.md`
