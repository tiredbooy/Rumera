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
| Order confirmation | `order-confirmation-view.tsx` (earn **after paid**, not place-only) |

## Behaviour (PH-040c)

- **Ledger clarity:** all known `reason` values mapped in `features/loyalty/reasons.ts`.
- **How to earn:** rewards page explains paid order, verified review, birthday, referral.
- **Errors:** loyalty load/redeem use `apiErrorMessage` / `apiErrorToast` (no generic-only).
- **Redeem:** sends `Idempotency-Key` (stable per intent) for HTTP + domain spend key.
- **Review toast:** if API returns `verified_purchase`, show default review bonus
  copy (`DEFAULT_REVIEW_BONUS_POINTS` = backend default `LOYALTY_REVIEW_BONUS` 50).
  Non-verified: honest “no club points” note.
- **Order confirmation:** do **not** claim points on pending payment; link to rewards.

Do **not** invent earn amounts from the client beyond documented defaults aligned
with backend env defaults. Live balance/history always from `GET /loyalty*`.

## Admin (PH-040d)

| Surface | Path |
|---------|------|
| Programme rates (read-only) | `/admin/loyalty` · `features/admin/loyalty/` |
| API | `GET /admin/loyalty/programme` (`customers:read`) |

Rates are **env-backed** (`editable: false`). Operators change `LOYALTY_*` and restart — no admin write form.

## Related FE

- Referral card on same rewards page
- Wallet after redeem refresh via `walletKeys`
