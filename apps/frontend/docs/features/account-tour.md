# Customer account tour

**Who this is for:** engineers working on anything under `/account`, or linking
storefront loyalty/wallet/gift-card behavior to the signed-in experience.

**Related:** [BFF & auth](../platform/bff-and-auth.md) · [domain map](./domain-map.md) ·
backend APIs under [`docs/api/`](../../../backend/docs/api/) (wallet, loyalty, …)

---

## What “account” is

The **customer dashboard** for signed-in shoppers: orders, addresses, wishlist,
rewards, wallet, taste profile, subscriptions, reviews, and settings. It is
**not** the staff admin console (`/admin`).

```
Browser /account/*
  → edge proxy (coarse)
  → app/(account)/account/layout.tsx
       requireUser()  → redirect /login if anonymous
       force-dynamic + noindex
       AccountShell (sidebar / mobile drawer)
  → page → features/account/<area>/… + domain hooks (wallet, loyalty, …)
  → storeRequest → /api/store/* BFF → Go customer APIs
```

Access control is **server layout** (`requireUser`). The shell is presentational
only.

---

## Navigation map

Canonical links live in `lib/rbac/nav.ts` → `ACCOUNT_NAV` (used by
`AccountNav`):

| Label (UI) | Route | Primary feature code |
|------------|-------|----------------------|
| نمای کلی | `/account` | `features/account/account` overview |
| سفارش‌های من | `/account/orders` | `features/account/orders` + `features/orders` |
| آدرس‌ها | `/account/addresses` | `features/account/addresses` + `features/addresses` |
| علاقه‌مندی‌ها | `/account/wishlist` | `features/account/wishlist` + `features/wishlist` |
| سلیقهٔ من | `/account/taste` | `features/account/taste` + `features/taste` |
| باشگاه مشتریان | `/account/rewards` | `features/account` rewards + `features/loyalty` (+ referral UI) |
| اشتراک‌ها | `/account/subscriptions` | `features/account/subscriptions` + `features/subscriptions` |
| کیف پول | `/account/wallet` | `features/account/wallet` + `features/wallet` |
| دیدگاه‌های من | `/account/reviews` | `features/account/reviews` + `features/reviews` |
| تنظیمات حساب | `/account/settings` | `features/account/settings` + profile |

Folder layout under `app/(account)/account/` mirrors these routes.

---

## Domain capabilities (product meaning)

### Overview (`/account`)

Composes wallet balance, loyalty progress, taste completeness, and shortcuts.
Uses React Query hooks from multiple domains in one view
(`account-overview.tsx`). Treat each card as independently loadable/errorable.

### Orders

List + detail of **the caller’s** orders only. Backend always scopes by `uid`
from JWT. Cancellation and status display follow order API semantics; payment
status is a read model (settlement is webhook-driven — see
[payments-and-webhooks](../../../backend/docs/architecture/payments-and-webhooks.md)).

### Addresses

CRUD address book used by checkout. Ownership-scoped. Checkout **must** pick a
server-known address id; region for shipping is derived from country server-side.

### Wishlist

Saved variants/products. Availability should stay honest if stock changes
(backend inventory rules).

### Taste profile (`/account/taste`)

Preference categories for personalization / recommendations. Empty state is a
first-run prompt on the overview when no categories are set.

### Rewards / loyalty (`/account/rewards`)

| Backend | Frontend |
|---------|----------|
| `GET/POST …/loyalty` | `features/loyalty/api.ts` + hooks |
| Points earn on **paid** orders | `PaymentService.Confirm` → `loyalty.AwardForOrder` |
| Redeem points | `loyalty/redeem` via BFF |
| Config | `LOYALTY_EARN_DIVISOR`, `LOYALTY_REDEEM_VALUE`, `LOYALTY_SIGNUP_BONUS` |

Earn is **server-side after payment confirmation**, not when the order is merely
created. UI must not invent balances.

### Referral

| API | Role |
|-----|------|
| `GET referrals/me` | Share code / status |
| `POST referrals/claim` | Attach code as referee |
| On paid order | `referral.OnPaidOrder` completes pending referral (backend) |

Often surfaced inside rewards / settings marketing copy; claim may also appear
in onboarding flows.

### Wallet (`/account/wallet`)

| API | Role |
|-----|------|
| `GET /wallet` | Balance (get-or-create) |
| `GET /wallet/transactions` | Ledger |
| `POST /wallet/deposit` · `withdraw` | Server endpoints exist |
| Gift-card redeem | Credits wallet via gift-card domain |

**UI note:** top-up may show “coming soon” (`wallet-topup-comingsoon`) while
gift-card redeem is the active credit path in the storefront wallet view.
Checkout can still offer `wallet` as a **payment method** for orders when the
backend accepts it.

Gift cards:

- Customer redeem: wallet UI + `features/wallet/gift-card-redeem.tsx`
- Admin issue: `features/admin/gift-cards` + gift-card APIs
- Backend: atomic batch create (integration-tested)

### Subscriptions

Recurring product subscriptions under `/account/subscriptions`. Backend renewal
cron: `subscription_renewal_job`. Frontend list/manage via
`features/subscriptions`.

### Reviews

Customer’s own product reviews; create/edit flows constrained to purchased or
API-allowed products per backend rules.

### Settings

Profile fields, password, notification-ish preferences, links into loyalty and
other sub-areas. Validation in feature modules; server remains authoritative.

---

## Code ownership pattern

```
features/account/<surface>/components   # route-level views + chrome
features/<domain>/api.ts · hooks.ts     # BFF clients + React Query
features/<domain>/types.ts              # wire types matching Go JSON
```

Example: wallet **view** under `features/account/wallet`, wallet **API** under
`features/wallet`. Do not fetch wallet from a random `lib/` helper.

---

## Auth and caching rules

- Entire account tree is **`force-dynamic`** and **`noindex`**.
- All money and PII reads go through **BFF** (`storeRequest`) so the bearer
  never hits the browser.
- Never cache account pages with public storefront tags.
- Sign-out uses Auth.js `signOut` from the shell.

---

## Cross-links from storefront

| Storefront action | Account impact |
|-------------------|----------------|
| Place order | Appears under orders; payment pending until webhook |
| Pay successfully | Loyalty earn + possible referral complete |
| Redeem gift card | Wallet credit |
| Add wishlist on PDP | Wishlist page |
| Checkout address | Address book |

---

## Testing anchors

- Wallet / gift-card unit tests under `features/wallet`, `features/gift-cards`
- Backend integration: `tests/integration/gift_card_test.go`
- Session guards: `lib/auth/session.test.ts`
- Future Playwright (Task 062): login → account nav → wallet/orders smoke
