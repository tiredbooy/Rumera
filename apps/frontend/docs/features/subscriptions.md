# Subscriptions (cellar box) — storefront

**Route:** `/account/subscriptions`  
**Code:** `features/subscriptions/`  
**Backend model:** [box-subscriptions.md](../../../backend/docs/architecture/box-subscriptions.md) (PH-043a / PH-043b)

## Product meaning

Customers manage a **recurring physical box** (باکس سرداب). This is **not**:

- unlimited store access while “subscribed”
- streaming / digital entitlements
- multi-seat SaaS

## UI building blocks (PH-043b polish)

| Component | Role |
|-----------|------|
| `SubscriptionsView` | Compose create + list + confirm; `apiErrorToast`; optional address on create |
| `SubscriptionCreatePanel` | Cadence + optional ship-to; no-charge honesty bullets |
| `SubscriptionCard` | Status, **ارسال باکس بعدی** + hint, missing-address callout, actions |
| `SubscriptionActionDialog` | Confirm **pause / skip / cancel** with effect copy |
| Helpers | `nextShipTitle/Hint`, `statusCopy`, `actionSuccessMessage`, `actionConfirmDescription` |

## Copy rules

| Surface | Language |
|---------|----------|
| Next date | «ارسال باکس بعدی» (active) — email reminder, **not** invoice |
| Skip | Moves next ship by one cadence; no auto charge |
| Pause | Holds; no due emails until resume |
| Cancel | No more boxes; reactivate via resume |

## API hooks

- `listSubscriptions` · `createSubscription` · `updateSubscription`
- Types: cadence `monthly|quarterly`; status `active|paused|cancelled`
- Actions: `pause` · `resume` · `cancel` · `skip`
- Create may send `address_id` when user selects one (default address preferred)

## Honesty constraints

- Create does **not** take payment in the UI or API
- “Next” date is the next box **window** (renewal email), not a paid invoice
- Contents preference is **not** exposed (not on the wire)

## Related

- [account-tour.md](./account-tour.md)
- Backend [api/subscriptions.md](../../../backend/docs/api/subscriptions.md)
