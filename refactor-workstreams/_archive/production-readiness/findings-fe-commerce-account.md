# Findings — fe-commerce-account

**Agent:** `fe-commerce-account`  
**Workstream:** `production-readiness-20260816` (WAVE 2)  
**Date:** 2026-08-16  
**Mode:** Investigation only. No application code changed.

**Lane:** checkout + confirmation + `app/(account)/**` + `app/(auth)/**` + account overview.

**IDs:** this lane proposes **PR-030a–n** so `fe-storefront` can keep **PR-020**. Already claimed PR-003*, PR-004*, PR-005a–c, PR-010*, PR-011* are **not** re-proposed.

---

## What was inspected

- Checkout: `features/checkout/components/*`, `app/(storefront)/checkout/**`, empty `features/checkout/api.ts`
- Place-order: `features/orders/hooks.ts`, `api/account-client.ts`, `api/account.ts`
- Confirmation: `features/orders/components/order-confirmation-view.tsx`
- Cart line UX (5.10): `features/cart/api.ts`, `cart-lines.tsx`, `cart-view.tsx`
- Account shell/nav/overview + every `app/(account)/account/**` page
- Orders list/detail, addresses, wallet + gift, reviews, rewards/referral, wishlist, taste, subscriptions, settings
- Auth: `app/(auth)/**`, `features/auth/**`, store/public BFF allow-lists, `lib/auth/session.ts`
- BE contracts (read-only): `orders/service.go` CreateOrder + pending payment, `payments/routes.go` (customer no-op), `reviews` mine/pending, `alerts` routes, `docs/api/auth.md`

---

## Historical IMPROVEMENT re-verify

### 5.7 Three account hooks call endpoints that don't exist — **RESOLVED**

Dated claim (`docs/IMPROVEMENT-OPPORTUNITIES.md`): `account-hooks.ts` `recommendations`, `reviews/mine`, `reviews/pending` → 404.

**Current evidence:**

| Call | Exists? |
| --- | --- |
| `lib/api/account-hooks.ts` | **Deleted.** No TS/TSX importer. Docs (`docs/platform/api-layer.md`) are stale. |
| `GET /reviews/mine` | BE `reviews/routes.go:22` + `handler.go:146` `response.OK`. Docs `api/reviews.md`. |
| `GET /reviews/pending` | Same, `handler.go:160`. |
| FE | `features/reviews/client.ts` via `storeRequest("reviews/mine"|"reviews/pending")`. BFF `ALLOW` includes `"reviews"`. |
| Types | FE `AccountReview` / `PendingReview` match `AccountReviewResponse` / `PendingReviewResponse` (`product_id`, slug, title, image, rating/content/status or order_id). Envelope `{data:[]}`. |
| Recs widget | Account overview uses `useForYou` → `recommendations/for-you` (`product_id`), not bare `recommendations`. BFF allow-lists `"recommendations"`. |

Account **Reviews** page has loading / error / empty / delete confirm. Pending tab deep-links to PDP to write (no inline form). Not a 404.

### 5.10 Cart mutations have no optimistic update, no remove toast/undo — **STILL OPEN**

| Claim | Current code |
| --- | --- |
| Hooks only `onSuccess` | `features/cart/api.ts:88-128` — add / bulk / update / remove / clear: `onSuccess` set/invalidate only. No `onMutate`. Contrast wishlist `hooks.ts:27` gold-standard. |
| Shared `busy` dims all lines | `cart-lines.tsx:28` `busy = update.isPending \|\| remove.isPending`; qty/remove `disabled={busy}` (`:175`, `:198`, `:212`); line total `busy && "opacity-50"` (`:221`). |
| Remove no toast / undo | `remove.mutate(item.id)` (`:178`) — no sonner, no snapshot restore. |

Add-to-cart **button** is a different surface (already in PR-004). This leftover is **drawer + cart page line edits**.

### 5.16 Account overview fires 6 client queries, no server prefetch — **STILL OPEN**

`app/(account)/account/page.tsx` is a server component but only `getSession()` for first name.

`AccountOverview` (`features/account/account/components/account-overview.tsx:121-127`) on mount:

1. `useOrders()`
2. `useAddresses()`
3. `useWallet()`
4. `useLoyalty()`
5. `useTasteProfile()`
6. `useForYou()`

Repo grep: `HydrationBoundary` / `dehydrate` / `prefetchQuery` appear only in `docs/platform/data-fetching.md` as **“there is none”**. PDP reviews were the intended template; still unused.

KPI “سفارش‌های فعال” is also **wrong under pagination** (see PR-030g): `useOrders()` with no query → BE default `limit=20` (`models/filter.go:14-16`) → `activeCount` only counts page 1.

### 6.16 Wishlist “add all to cart” reports success unconditionally — **RESOLVED**

`WishlistView.addAllToCart` (`wishlist-view.tsx:172-245`) posts **one** `useBulkAddCartItems` payload. `getBulkFeedback` (`:45-90`) uses `result.added` + `result.skipped` (success / warning / error). Tests in `wishlist-view.test.tsx:110-182` lock partial and all-skipped. Per-row skip reasons mapped.

PR-004d (wishlist **single** add swallows stock codes) remains claimed — not this item.

---

## Live bugs / gaps (new)

### P0 — Checkout does not collect money, then celebrates

**Selling path today:**

1. Checkout payment step (`checkout-payment-step.tsx:19-27`) offers **wallet** and **bank_transfer** only. Default `useState("wallet")`. No balance, no insufficient-funds guard, no gateway/card.
2. Submit (`checkout-flow.tsx:238-283`) `POST /api/store/orders` `{address_id, shipping_method_id, payment_method, coupon_code?, gift…}`. Toast «سفارش ثبت شد». Fires `purchase` recs **immediately**. Navigates to `/checkout/confirmation/:id`.
3. BE `CreateOrder` (`orders/service.go:285-295`) commits **pending**, clears cart, then `createPendingPayment` (best-effort). **Does not debit wallet.** Currency hardcoded `"USD"` (`:29`, `:325`).
4. `payments.RegisterCustomer` is empty (`payments/routes.go:18-19`). No customer pay/start/retry. No `payment_url` on wallet top-up / gift purchase types either (PR-005a).
5. Store BFF `ALLOW` has no `"payments"`.
6. Confirmation (`order-confirmation-view.tsx:61-69`) always: CheckCircle, «سفارش تأیید شد», «سپاس از خرید شما» even when `status === "pending"` / `payment_failed`. Loyalty block **is** paid-gated (`:50-56`, `:109-119`) — PR-003m already shipped.

**Effect:** customer thinks they paid (especially “کیف پول رومرا”). Cart is empty. Order sits pending. No IBAN, no gateway redirect, no “ادامه پرداخت”.

Wallet top-up / gift purchase (`wallet-topup.tsx`, `gift-card-purchase.tsx`) have the same hole: pending phase copies `transaction_id` and says “pay at the gateway” with **no URL**. Claimed as PR-005a; FE still needs a redirect/CTA after 005a.

### P1 — Account orders list tabs lie under pagination

`OrdersList` (`OrdersList.tsx:49-55`) `useOrders({ page })` then **client-filters** the current page by tab (`processing` = pending|paid|processing|ready_to_ship, etc.). BE `GET /orders` accepts a **single** `status` (`OrderFilter.Status *OrderStatus`). Default page size 20.

A user with 20 recent pending orders and delivered ones on page 2 sees tab «تحویل‌شده» as empty.

Same first-page bias on overview active KPI.

### P1 — Auth login maps every failure to “wrong password”

`LoginForm` / `PhoneLoginForm` treat any `signIn(..., {redirect:false})` error as credentials/OTP invalid.

`lib/auth/auth.ts` `authorize` catches `AuthServerError` and **returns null** (`:99-106`) — NextAuth cannot surface 429 / upstream 5xx / inactive. Forgot-password is enumeration-safe (good). Reset does not call `GET /auth/password/validate` (public BFF already allow-lists it).

Auth pages never bounce an existing session.

Settings Security: change-password / 2FA honestly «به‌زودی». BE has **no** logged-in change-password (only forgot/reset). Do not fake it.

### P1 — Subscriptions cannot change ship-to (FE + claimed BE) — **closed PR-035b**

UI create picks `address_id`. Active / paused cards pick from `useAddresses()` and PATCH `{ address_id }` (PR-005c). Cancelled stays read-only. Amber missing-address callout remains when unresolved.

### P2 — Account product-alerts management missing

BE `GET/POST/DELETE /alerts`, BFF allow-lists `alerts`, hooks exist. Only PDP `alert-button` creates. No `/account` list/delete.

### P2 — Wallet ledger is a 100-row client window

`WalletView` `FETCH_LIMIT = 100` then filters/pages in the browser. BE `GET /wallet/transactions` is paginated. Month summary and date range miss older rows.

### P2 — Confirmation / order detail have no pay-again or invoice

Order detail: reorder (bulk cart) + cancel if `pending|payment_failed` (no confirm dialog). No “پرداخت مجدد”, no tracking, no invoice. 6.22 still accurate (no invoice/tracking contract).

### P2 — Leftover empty domain files — **closed PR-035d**

Empty feature-split shells deleted (no importers). Live checkout/account still
consume domain modules (`features/orders`, `addresses`, `cart`, `shipping`,
`wishlist`, `reviews`, `profile`). Also removed unused empty
`features/checkout/{types,validations}.ts` and `features/account/addresses/api.ts`.

`/account/rewards` is **not** leftover — it is live loyalty + `ReferralCard`. URL name vs «باشگاه» only.

### P2 — SEO residual (6.12)

`robots.ts` disallows `/account`, `/login`, `/register`, `/cart`, … — **not** `/checkout`. Checkout layout already `noindexMetadata`. Offer to `fe-storefront` / `fe-platform-quality`.

### P2 — Purchase recs on unpaid create

`checkout-flow.tsx:261-282` records `interaction_type: "purchase"` on place-order success. BE earn is after Confirm. Same signal should wait for paid-like status (or confirmation after pay).

---

## What is in good shape (do not “fix”)

- Checkout is `requireUser` + `force-dynamic` + noindex layout; guest e2e expects login hop.
- Wizard: address → shipping (region from address country, weight from cart) → payment/coupon/gift (site-settings priced) → review. Empty cart recovery. Coupon revalidate on subtotal change.
- Shipping empty/error/retry copy exists.
- Confirmation earn copy paid-gated; gift snapshot shown.
- Account layout `requireUser` + noindex; error boundary; nav complete for built surfaces.
- Addresses CRUD + default; taste quiz via `/me/taste-profile` (BFF `"me"` allow-listed — old 1.2 is dead).
- Wallet: no free deposit UI; withdraw not surfaced; gift purchase/redeem/mine live on wallet page.
- Rewards: redeem + idempotency key (BFF drop is PR-003c); POINT_VALUE leftover is PR-003l.
- Referral: `ReferralTracker` on storefront layout captures `?ref=` and claims after login.
- Wishlist optimistic + bulk add-all (6.16).
- Auth: `safeCallbackUrl` blocks open redirects; OTP + email; forgot always 202; bcrypt 72-byte check; SessionGuard on refresh death; public BFF allow-list tight.

---

## Proposed tasks (PR-030*)

Do **not** implement until founder says so.

### Task Group PR-030 — Checkout money honesty + confirmation

- [ ] **PR-030a — Confirmation + post-place UX matches order status** · **fe** · **P0** · **S**  
  Pending / `payment_failed` must not say «تأیید شد / سپاس از خرید». Show «در انتظار پرداخت», status badge, next step. Paid-like can keep celebration. `order-confirmation-view.tsx`.

- [ ] **PR-030b — Checkout payment methods must not imply a completed wallet debit** · **fe** · **P0** · **S**  
  Until BE actually debits or returns a pay URL: do not default to wallet as if it pays now; show balance if wallet stays; copy that bank transfer is manual. Depends on `be-money-ops` Q1.

- [ ] **PR-030c — Consume payment_url (after PR-005a)** · **fe** · **P0** · **S**  
  Redirect or “پرداخت در درگاه” on checkout, confirmation, order detail, wallet top-up, gift purchase. Add BFF `"payments"` only if the start path is under `/payments`. Do not invent the URL field.

- [ ] **PR-030d — Bank-transfer instructions on checkout + confirmation** · **fe** · **P1** · **S**  
  After `be-money-ops` confirms there is no receipt API: static IBAN from site settings (if present) or honest “منتظر تأیید اپراتور”. Never toast success-as-paid.

- [ ] **PR-030e — Fire `purchase` recs only after paid-like status** · **fe** · **P2** · **S**  
  Move from `placeOrder.onSuccess` to confirmation (or a paid webhook-driven refresh). Aligns with earn-after-Confirm.

### Task Group PR-031 — Cart line UX (IMPROVEMENT 5.10)

- [ ] **PR-031a — Optimistic qty/remove + per-line busy + remove undo** · **fe** · **P1** · **M**  
  Copy wishlist `onMutate`/rollback. Scope disable to the mutating `item.id`. Toast remove with undo that `addCartItem`s the snapshot. Use `cartMutationErrorMessage` (leftover of PR-004b).

### Task Group PR-032 — Account overview prefetch (IMPROVEMENT 5.16)

- [ ] **PR-032a — RSC prefetch + HydrationBoundary for overview** · **fe** · **P2** · **M**  
  Prefetch orders (or a small summary), addresses, wallet, loyalty, taste, for-you. Same query keys as the six hooks. Also fix active-order KPI (pair with PR-033a).

### Task Group PR-033 — Account orders correctness

- [ ] **PR-033a — Order tabs must not client-filter one page** · **both** · **P1** · **S**  
  Pass `status` (or multi-status if BE adds it) per tab; reset page. Overview KPI needs either `status` set or a count field — not `results.filter` on page 1 of 20.

- [ ] **PR-033b — Cancel confirm + pending pay CTA** · **fe** · **P2** · **S**  
  AlertDialog on cancel. If PR-030c has a URL, show «ادامه پرداخت» on pending / `payment_failed`. No fake invoice/tracking (6.22 stays).

### Task Group PR-034 — Auth UX

- [ ] **PR-034a — Surface real login/OTP errors; bounce signed-in users** · **fe** · **P1** · **S**  
  Map 429 / upstream / inactive once `be-identity-security` lists codes (or stop swallowing in `authorize`). Redirect `/login` `/register` when session is valid.

- [ ] **PR-034b — Validate reset token on load** · **fe** · **P2** · **S**  
  `GET /api/public/auth/password/validate?token=` already allow-listed. Empty/invalid token UI already exists; use it before the form.

### Task Group PR-035 — Account leftovers

- [ ] **PR-035a — Account alerts list/delete** · **fe** · **P2** · **S**  
  `GET /alerts` + existing hooks. Nav item under account.

- [x] **PR-035b — Subscription address change UI (after PR-005c)** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  Card picker PATCHes `{ address_id }` on active/paused.

- [ ] **PR-035c — Wallet ledger uses server pagination** · **fe** · **P2** · **S**  
  Stop `limit=100` + client date/dir filter as source of truth.

- [x] **PR-035d — Delete empty account/checkout stub modules** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  Empty `api.ts` / `types.ts` / `validations.ts` listed above. Platform-quality can take this.

---

## Explicit non-goals

- Do not re-implement PR-003c (BFF Idempotency-Key), PR-003l (POINT_VALUE), PR-003m (earn copy).
- Do not re-implement PR-005a–c (payment_url, gift email, sub `address_id` BE).
- Do not re-implement PR-004a–d / cart UNIQUE.
- Do not add guest cart.
- Do not invent customer payment routes or `payment_url` field names.
- Do not fake settings password change / notifications / delete-account.
- Do not reopen PH-043c auto-charge.

---

## Suggested claim order (when implementing)

1. PR-030a + PR-030b (stop lying about paid)  
2. PR-005a (BE) then PR-030c  
3. PR-033a (orders truth)  
4. PR-034a  
5. PR-031a (5.10)  
6. PR-032a (5.16)  
7. PR-030d/e, PR-033b, PR-034b, PR-035*

No application code changed.
