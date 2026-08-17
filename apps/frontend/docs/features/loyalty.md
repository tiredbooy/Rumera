# Storefront loyalty (Cellar Club)

**Who this is for:** FE engineers changing rewards UX, review earn toasts, or
order confirmation copy.

**Backend rules:** [loyalty architecture](../../../backend/docs/architecture/loyalty.md) ·
[API](../../../backend/docs/api/loyalty.md)

---

## Surfaces

| Surface | Path |
|---------|------|
| Rewards page | `/account/rewards` → `features/loyalty/components/rewards-view.tsx` |
| Account KPI | `account-overview.tsx` (points snapshot) |
| Review earn toast | `write-review-dialog.tsx` when `verified_purchase` |
| Checkout payment step | `checkout-payment-step.tsx` — link to `/account/rewards`; **no** unpaid earn amount |
| Order confirmation | `order-confirmation-view.tsx` (earn **after paid**, not place-only) |

## Behaviour (PH-040c)

- **Ledger clarity:** all known `reason` values mapped in `features/loyalty/reasons.ts`.
  `GET /loyalty/transactions` is `{results, pagination}` (default `limit` 20);
  `listLoyaltyTransactions` returns that envelope; `useLoyaltyTransactions`
  still yields the row array. Rows may include `id` / `ref_type` / `ref_id`.
- **How to earn:** rewards page explains paid order, verified review, birthday, referral.
- **Errors:** loyalty load/redeem use `apiErrorMessage` / `apiErrorToast` (no generic-only).
- **Redeem:** sends `Idempotency-Key` (stable per intent) for HTTP + domain spend key.
  The store BFF forwards that header to Go; it never invents one.
- **Redeem rate (PR-003l):** `GET /loyalty` includes `redeem_value` (Toman per
  point from the persisted programme). `/account/rewards` uses that field — it
  does **not** hardcode 1000. Preview `points * redeem_value` only when
  `redeem_value > 0`. Loading, missing, or `≤0` shows a dash (never a silent 1000).
- **Review toast:** if API returns `verified_purchase`, show default review bonus
  copy (`DEFAULT_REVIEW_BONUS_POINTS` = backend default `LOYALTY_REVIEW_BONUS` 50).
  Non-verified: honest “no club points” note.
- **Order confirmation:** do **not** claim points on pending payment; link to rewards.
- **Checkout:** payment step links to `/account/rewards` (Cellar Club). Copy is
  honest — points (if any) after **successful payment**, not on place-order.
  Do **not** invent `floor(total/divisor)` or redeem Toman on unpaid checkout.

Do **not** invent earn amounts from the client beyond documented defaults aligned
with backend env defaults. Live balance/history always from `GET /loyalty*`.

## Admin (PH-040d + PR-003b)

| Surface | Path |
|---------|------|
| Programme rates (read-only) | `/admin/loyalty` · `LoyaltyProgrammeView` |
| Member search | `/admin/loyalty?q=&tier=&page=` · `LoyaltyMembersView` |
| Member account + ledger + adjust | `/admin/loyalty/[userID]` |
| API (server `apiFetch`) | `GET /admin/loyalty/programme` |
| | `GET /admin/loyalty/members` → `{results, pagination}` |
| | `GET /admin/loyalty/members/:userID` |
| | `GET /admin/loyalty/members/:userID/transactions` |
| Adjust (client, `customers:write`) | `POST /admin/users/:userID/loyalty/adjust` via `/api/admin/admin/users/:userID/loyalty/adjust` |
| Programme edit (client, `customers:write`) | `PUT /admin/loyalty/programme` via `/api/admin/admin/loyalty/programme` |

Rates and tiers are **db-backed** (`loyalty_programme`, PR-003f) and edited in
place — `LoyaltyProgrammeForm` PUTs `/admin/loyalty/programme` (L-1). `LOYALTY_*`
seeds the first row only; no restart is involved. The read-only notice now
appears solely when `editable: false`, i.e. the programme row does not exist yet
and the API is serving the env fallback.

Two things the form does not do. It round-trips `enabled` without exposing a
control — the server validates it as required, so dropping it would 422 every
save; the visible kill switch is L-2. And editing `referral_reward` affects new
referrals only: `referral.Service` is constructed with the env value and stamps
it at referral-creation time, so existing referrals pay out at their stamped
rate.

`customers:read` is required for the list and member pages (`requirePermission`
→ `/forbidden`). Adjust is hidden without `customers:write` (same gate as
`WalletCreditForm`). `:userID` is the public UUID.

If `GET /admin/loyalty/programme` fails, the page keeps the shared retry card
and still renders member search. Member list / ledger failures use the same
retry card. Unknown UUID → admin `notFound()`. Empty search and empty ledger
have dedicated Persian empty states.

## Related FE

- Referral card on same rewards page
- Wallet after redeem refresh via `walletKeys`
