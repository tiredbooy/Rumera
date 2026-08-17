# Storefront wallet

**Who this is for:** FE engineers changing balance, ledger, top-up, or gift redeem.

**Backend:** [wallet API](../../../backend/docs/api/wallet.md) ·
[wallet top-up architecture](../../../backend/docs/architecture/wallet-topup.md)

---

## Surfaces

| Surface | Path |
|---------|------|
| Account wallet | `/account/wallet` → `features/account/wallet/components/wallet-view.tsx` |
| Gateway top-up | `features/wallet/wallet-topup.tsx` (PH-041b) |
| Gift card purchase / mine | `features/gift-cards/*` (PH-042b) — see [gift-cards.md](./gift-cards.md) |
| Gift card redeem | `features/wallet/gift-card-redeem.tsx` |

## Top-up UX (PH-041b)

1. Customer picks a **preset** or custom amount (10 000 … 50 000 000 IRT).
2. `POST /wallet/topup` with `Idempotency-Key` → store BFF forwards the header
   unchanged → **pending** intent (`transaction_id` + optional `payment_url`).
3. Pending UI copies the tx id. If `payment_url` is non-empty, primary **پرداخت
   در درگاه** uses that absolute URL as-is (same window). Empty/missing URL
   keeps the pending copy only — FE never invents a start URL (PR-030c).
4. After gateway payment + webhook, customer taps **بروزرسانی موجودی** to refresh
   balance + ledger.

**Not free money:** no deposit form; withdraw is not offered (API 410).

## Related

- Loyalty redeem also credits wallet (see loyalty FE)
- Admin credit is staff-only (`wallet-credit-form`)
