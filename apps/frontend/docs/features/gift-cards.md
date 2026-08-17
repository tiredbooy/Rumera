# Storefront gift cards

**Who this is for:** FE engineers changing purchase, mine list, redeem, or admin issue/list/void UX.

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
| Admin issue + ledger | `/admin/gift-cards` (`gift-cards:issue`) |

## Purchase UX (PH-042b)

1. Customer picks a **preset** or custom amount (10 000 … 50 000 000 IRT).
2. `POST /gift-cards/purchase` with `Idempotency-Key` → store BFF forwards the
   header unchanged → **pending** intent (`gbuy-…` + optional `payment_url`).
3. UI shows pending state (copy tx id). **No code yet.** If `payment_url` is
   non-empty, primary **پرداخت در درگاه** uses that absolute URL as-is (same
   window). Empty/missing URL keeps pending copy only — no invented start URL
   (PR-030c).
4. After gateway payment + webhook, customer taps **بروزرسانی کارت‌ها** →
   `GET /gift-cards/mine` shows `code` + face amount + status.
5. Self-use: paste code into redeem, **or** copy/send code as a gift.

**Not free money:** no code without paid `gbuy-…` settlement. Staff issue is separate.

## Admin ledger (PR-064a)

`/admin/gift-cards` is issue **and** a paginated operator list. The board
reads `GET /admin/gift-cards` (`{results, pagination}` — not `{data}`) with
`page` / `limit≤20` / `status` / `search` / `sortBy`+`orderBy`. URL state is
`page`, `status`, `q`, `sort`. A failed fetch is a retryable error, not an
empty ledger.

Void is `POST /admin/gift-cards/:id/void` after confirm. It only applies to
`active` cards (`409 INVALID_STATE` otherwise). **Void is not a refund** and
does not move wallet money. Toasts follow the real response; a `409`/`404`
message is shown as-is. `purchaser_user_id` / `redeemed_by` are numeric
internal ids — the UI does not invent `/admin/customers/:uuid` links.

## Redeem polish

- Single-use: full `initial_amount` credits wallet once.
- Sends `Idempotency-Key` (store BFF forwards it); card status is the domain natural key.
- No partial balance API — “balance check” in UI = show face amount on mine list
  and honest copy that redeem is all-or-nothing.

## API client

| Call | Module |
|------|--------|
| `purchaseGiftCard` · `listMyGiftCards` · `redeemGiftCard` | `features/gift-cards/api/account.ts` |
| `createGiftCardsClient` · `listAdminGiftCardsClient` · `voidAdminGiftCardClient` | `features/gift-cards/api/admin-client.ts` |
| Hooks | `usePurchaseGiftCard` · `useMyGiftCards` · `useRedeemGiftCard` · `useAdminGiftCards` · `useVoidGiftCard` · `useCreateGiftCards` |

## Related

- Wallet top-up: `docs/features/wallet.md`
- Account tour: `docs/features/account-tour.md`
