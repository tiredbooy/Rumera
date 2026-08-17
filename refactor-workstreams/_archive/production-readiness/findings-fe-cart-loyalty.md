# Findings — fe-cart-loyalty

**Agent:** `fe-cart-loyalty`  
**Workstream:** `production-readiness-20260816`  
**Date:** 2026-08-16  
**Mode:** Investigation only. No application code changed.

---

## What was inspected

### Cart / add-to-cart (PR-004)

- `apps/frontend/features/cart/components/add-to-cart-button.tsx` + `.test.tsx`
- `apps/frontend/features/cart/api.ts`, `errors.ts`, `errors.test.ts`, `types.ts`, `normalize.ts`
- `apps/frontend/features/catalog/products/components/product-card.tsx`
- `apps/frontend/features/catalog/products/components/product-card-actions.tsx`
- `apps/frontend/features/catalog/products/catalogue-presentation.ts` (`isQuickPurchasable`)
- `apps/frontend/features/catalog/products/types.ts` (`purchasable_variant_id`)
- Other add-to-cart callers: PDP `product-purchase-panel.tsx`, journal `article-product-card.tsx`, recipes `shoppable-product-card.tsx`, wishlist `wishlist-view.tsx`
- Store BFF allow-list `apps/frontend/app/api/store/[...path]/route.ts`
- Error mapping `apps/frontend/lib/api/user-facing-error.ts` + `store-client.ts`
- Cart page / drawer: `cart-view.tsx`, `cart-button.tsx`, `cart-lines.tsx`
- Checkout: `features/checkout/components/*` (no loyalty)
- Backend (contract / 500 path, not implementing): `cart/handler.go`, `cart/service.go`, `cart/repository.go`, `cart/model.go`, migrations `20260526174414_create_carts.sql`, `20260714130000_cart_inventory_integrity.sql`, product list `purchasable_variant_id` SQL

### Loyalty admin + customer (PR-003)

- `/admin/loyalty` page + `LoyaltyProgrammeView` + `features/admin/loyalty/{types,api/server}`
- Customer `/account/rewards` + `RewardsView` + `features/loyalty/{api,hooks,types,reasons}`
- Account overview loyalty KPI
- Admin customer detail (wallet credit present, **no** loyalty)
- Backend: `docs/api/loyalty.md`, `docs/architecture/loyalty.md`, `loyalty/{routes,handler,model,service}.go`
- Admin BFF allow-list (programme is SSR `apiFetch`, not `/api/admin`)
- RBAC: `PERMISSIONS.CUSTOMERS_READ` only; no `loyalty:write`
- Store/admin BFF header forwarding (`Idempotency-Key`)

**Not re-opened:** PH-040a–e env programme, earn triggers, redeem idempotency **on Go**, read-only admin snapshot. Those shipped. Gap is “operator complete” + shopper rate truth + BFF dropping money headers.

---

## PR-004 — Add-to-cart 500

### Evidence: the card sends a real variant id (not product id)

| Step | File:line | What happens |
| --- | --- | --- |
| List projection | `apps/backend/internal/features/catalog/product/repository.go:429-438` | `purchasable_variant_id` = `MIN(pv.id)` only when `COUNT(*) = 1` active variant **and** available stock `> 0`. Else SQL `NULL` → omitted in JSON. |
| FE type | `apps/frontend/features/catalog/products/types.ts:59-60` | Optional `purchasable_variant_id?: number`. |
| Guard | `catalogue-presentation.ts:78-85` | `isQuickPurchasable` requires finite number `> 0`. |
| Card | `product-card.tsx:74-76, 156-160` | Passes that id only when quick-purchasable. |
| Overlay | `product-card-actions.tsx:132-139` | `<AddToCartButton productVariantId={purchasableVariantId} productId={productId} />`. Multi-variant → “انتخاب گزینه‌ها” link, not add. No variant → “در حال تأمین” / “ناموجود”. |
| Mutation | `add-to-cart-button.tsx:54-67` | Rejects invalid id client-side. Posts `{ product_variant_id: variantId, quantity: Math.trunc(qty) }`. |
| Client | `features/cart/api.ts:16-49` | Same contract; `POST cart/items`. |
| BFF | `app/api/store/[...path]/route.ts:18-19, 64-73, 88-96` | `"cart"` allow-listed. Forwards body + upstream status/JSON. Not a 403 path. |
| Backend | `cart/handler.go:35-50` + `cart/model.go:34-37` | `product_variant_id` required `min=1`; `quantity` 1–999. |

**Payload (authenticated):**

```http
POST /api/store/cart/items
Content-Type: application/json

{"product_variant_id":<int>, "quantity":1}
```

Guests: `add-to-cart-button.tsx:47-51` toast + `router.push(/login?callbackUrl=…)`. They never produce the 500.

Other surfaces also pass variant ids (`product.variants[].id`, recipe `product_variant_id`, wishlist `item.variant_id`). No card in this lane posts `product.id` as the cart target.

### Evidence: FE does not dump the envelope JSON

- `cartMutationErrorMessage` (`errors.ts:3-6`) → `apiErrorMessage`.
- `INTERNAL_ERROR` is mapped (`user-facing-error.ts:183-186`) to title «خطای غیرمنتظره رخ داد». Generic English `"an unexpected error occurred"` is stripped (`193-201`).
- Button onError (`add-to-cart-button.tsx:90`): `toast.error(cartMutationErrorMessage(error))`.
- Tests: `add-to-cart-button.test.tsx:87-95` (OUT_OF_STOCK Persian); `user-facing-error.test.ts:56-62`.

Founder-visible `{"error":{"code":"INTERNAL_ERROR","message":"an unexpected error occurred"}}` is the **HTTP 500 body**, not the toast string. PR-004b is largely already implemented; remaining FE polish is secondary.

### Evidence: 500 is backend `GetOrCreate` / swallowed repo errors

`Service.AddItem` (`cart/service.go:67-110`):

1. `variantRepo.GetByID` → `PRODUCT_NOT_FOUND` / `PRODUCT_UNAVAILABLE` / **else INTERNAL**
2. **`cartRepo.GetOrCreate` → any error INTERNAL** (`82-84`)
3. stock check → `OUT_OF_STOCK` or INTERNAL
4. `cartRepo.AddItem` → stock or INTERNAL
5. `reload`/`GetItems` → INTERNAL

`GetOrCreate` (`cart/repository.go:36-42`):

```sql
INSERT INTO carts (user_id) VALUES ($1)
ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
RETURNING *
```

Migration `apps/backend/migrations/main/20260526174414_create_carts.sql:2-10` creates `carts.user_id` as a nullable FK plus **non-unique** `INDEX idx_carts_user_id`. There is **no** later unique on `carts(user_id)` (unlike `uq_cart_items_cart_variant` in `20260714130000_cart_inventory_integrity.sql:31-32`).

Postgres: `there is no unique or exclusion constraint matching the ON CONFLICT specification` → repo error → `ErrInternal` → founder 500.

`GET /cart` uses the same `GetOrCreate` (`service.go:51-54`). If this is the sentinel, **GET cart 500s too**. This is **PR-004a** (`be`). FE cannot work around it.

---

## PR-003 — Loyalty completeness (admin first)

### What the UI assumes vs what BE exposes

| Surface | Assumes | Backend actually exposes |
| --- | --- | --- |
| `GET /admin/loyalty` + `LoyaltyProgrammeView` | Effective rates + tiers; lock badge; env runbook | `GET /admin/loyalty/programme` only (`loyalty/routes.go:23-29`). `editable` always `false` (`service.go:89-110`). |
| Staff can change rates / tiers | Badge branch `programme.editable` (`loyalty-programme-view.tsx:79-82`) | Never true after PH-040. Rates are process env. |
| Staff member lookup / ledger / adjust | Link to `/admin/customers` only (`loyalty-programme-view.tsx:161-164`) | **No** member/adjust routes mounted. `LoyaltyReasonAdminAdjust` exists (`model.go:40`) but no handler. Architecture §4.6 still **planned**. |
| Customer rewards | Balance, tier, redeem, ledger, earn copy | `GET /loyalty`, `GET /loyalty/transactions` (hard 50), `POST /loyalty/redeem`. No programme/rates on customer API. |
| Redeem value | `POINT_VALUE = 1000` (`rewards-view.tsx:39-40, 136, 236, 269`) | `LOYALTY_REDEEM_VALUE` (default 1000). Drift if env ≠ default. |
| Earn copy | Qualitative (paid order, verified review, birthday, referral) — no divisor/bonus numbers | Live env: earn divisor 10000, signup 100, review 50, birthday 200, referral 300. |
| Checkout | (none) | Redeem is wallet-only on `/account/rewards`. Checkout has coupon + gift + wallet pay, **zero** loyalty. |
| Admin customer | Wallet credit (`WalletCreditForm`) | No loyalty block on `customer-detail-view.tsx`. `AdminUser` has no points fields. |

### Admin page is not an operator surface

- `app/admin/loyalty/page.tsx:6-9`: `requirePermission(CUSTOMERS_READ)` then `getLoyaltyProgramme()` with **no try/catch**. Fetch failure = unhandled RSC error (no `app/admin/**/error.tsx`).
- View is a read-only env dump + Persian labels. Honest about PH-040 (restart to change rates; no free grant).
- Nav: `/admin/loyalty` under customers (`lib/rbac/nav.ts:129-134`).
- SSR uses `apiFetch("/admin/loyalty/programme")` → `${API_BASE}/admin/loyalty/programme`. Path matches `loyalty.RegisterAdmin` (`routes.go:186`).

**Admin UI does not assume any other paths.** Member search / ledger / adjust can follow `be-loyalty-money`’s proposed `GET /admin/loyalty/members` + `POST /admin/users/:userID/loyalty/adjust`. Prefer **UUID** `user_id` (same as `WalletCreditForm` / `/admin/customers/:id`).

Env + member search + ledger + signed adjust is enough for v1 “complete admin”. **No PUT programme** needed (their PR-003f can stay deferred).

### Storefront rewards is usable but incomplete

- Loading / error / empty ledger: good (`rewards-view.tsx:57-99, 290-367`). Uses `apiErrorMessage`, not raw JSON.
- Redeem: client validation + sends `Idempotency-Key` (`api.ts:22-39`) — **BFF drops it** (below).
- Earn copy does not show live rates; redeem Toman is hardcoded.
- Account overview shows balance/tier (`account-overview.tsx:357-396`).
- Reason labels include planned `admin_adjust` / `order_clawback` (`reasons.ts:13-14`).
- Checkout must **not** promise earn before `payments.Confirm`.

### Live: BFF drops `Idempotency-Key` (shared **PR-003c**)

`features/loyalty/api.ts:35-38` sets the header on `POST /api/store/loyalty/redeem`.  
`app/api/store/[...path]/route.ts:64-73` forwards only `Authorization` + `Content-Type`. Same drop on admin BFF (`app/api/admin/[...path]/route.ts:92-117`) for wallet credit.

Without the header, Go uses a nano-suffix spend ref → **double-click / retry can double-spend**. New live bug, not a PH-040 redo.

---

## Other production gaps (cart / checkout / loyalty)

### Guest cart

- DB comment: `Cart.UserID *int64` “guest carts have no user” (`cart/model.go:15`).
- HTTP: every cart handler requires `httpx.UID`.
- FE: login wall on button, cart page (`cart-view.tsx:45-59`), drawer (`cart-button.tsx:60-70`).
- `be-catalog-cart` confirms: no guest cart on BE; login wall is correct.

### Variant-less / multi-variant cards

- Cards do **not** send a fake id. Overlay CTAs are honest (`product-card-actions.tsx:140-178`).
- Touch users: body CTA “مشاهده و خرید” to PDP (`product-card.tsx:259-276`).
- `GetItems` never hydrates `options` (`cart/repository.go:194-221`); FE would render them (`cart-lines.tsx:164-168`).

### Error UX leftovers

- Add-to-cart button: mapped Persian. Good.
- Wishlist add (`wishlist-view.tsx:161-166`): swallows `OUT_OF_STOCK` / `PRODUCT_UNAVAILABLE`.
- Cart qty/remove (`cart-lines.tsx:29-33`): generic strings, not `cartMutationErrorMessage`.

---

## Proposed lettered tasks

Existing Phase 0 (do not duplicate work; refine):

| ID | Lane | Sev | Effort | Why |
| --- | --- | --- | --- | --- |
| **PR-003a** | be | P1 | M–L | Member list/GET + ledger + adjust still missing. Programme stays env/read-only. |
| **PR-003b** | fe | P1 | M–L | Admin operator UI after BE 003d/003e: members, ledger, adjust (mirror `WalletCreditForm`). |
| **PR-004a** | be | P0 | M | 500 on `GetOrCreate` (`ON CONFLICT (user_id)` without unique) + map remaining repo failures to 4xx. |
| **PR-004b** | fe | P0 | S | Mostly done. Tighten: `apiErrorToast` on add-to-cart; wishlist/cart-lines use `cartMutationErrorMessage`. |

New (Phase 1). IDs **PR-003c–j** are claimed by `be-loyalty-money` (003c = BFF header, shared). FE extras start at **003k**:

| ID | Lane | Sev | Effort | Why | Files |
| --- | --- | --- | --- | --- | --- |
| **PR-003c** | fe | P0 | S | Forward `Idempotency-Key` on store + admin BFF (same as be-loyalty-money). | `app/api/store/[...path]/route.ts`, `app/api/admin/[...path]/route.ts` |
| **PR-003k** | fe | P1 | S | `/admin/loyalty` has no try/catch; failed programme fetch is a blank RSC error. | `app/admin/loyalty/page.tsx` |
| **PR-003l** | fe | P1 | S | Stop hardcoding `POINT_VALUE = 1000`. Needs rates on `GET /loyalty` or customer programme GET. | `rewards-view.tsx`, `features/loyalty/*` |
| **PR-003m** | fe | P2 | S | Checkout: link to `/account/rewards`. Do **not** show unpaid earn. | `checkout-payment-step.tsx`, `checkout-flow.tsx` |
| **PR-004c** | fe | P2 | S | Document auth-required cart as intended. No cookie cart unless product asks. | docs |
| **PR-004d** | fe | P2 | S | Wishlist add-to-cart swallows mapped commerce codes. | `wishlist-view.tsx` |
| **PR-004e** | be | P2 | S | Cart `GetItems` omits variant options; FE already renders `item.options`. | `cart/repository.go` |

---

## Cross-notes

### `be-catalog-cart` — answers to your mid

1. **Yes.** Authenticated `POST /api/store/cart/items` body is `{ product_variant_id, quantity }`. Founder 500 is the Go envelope, not BFF 401/403.
2. **Same code path.** `GET /cart` also calls `GetOrCreate`. I did not run a live GET; if unique-on-user_id is the bug, GET 500s too.
3. **Confirmed.** Cards pass list `purchasable_variant_id` (variant PK), never product id. Multi-option cards do not render add-to-cart.
4. **Agreed.** Login wall is correct given no guest HTTP cart. Do not build cookie cart unless product asks.

### `be-loyalty-money` — answers to your mid

1. **No other admin paths assumed.** Only `GET /admin/loyalty/programme`. Your `GET /admin/loyalty/members` + transactions + `POST /admin/users/:userID/loyalty/adjust` is fine.
2. **`{results,pagination}`** for admin member/ledger lists — yes (same as customers).
3. **UUID** like wallet credit / `/admin/customers/:id`.
4. **No PUT programme in v1.** Env + member search + ledger + adjust is “complete admin”.
5. **Confirmed live bug.** Store + admin BFF drop `Idempotency-Key`. Adopt your **PR-003c**.

---

## Verdict

- **PR-004:** Not a missing `productVariantId` and not JSON dumped in the toast. Cards send a real variant id through an allow-listed BFF. The 500 is backend cart persist (`GetOrCreate` / INTERNAL mapping).
- **PR-003:** Customer rewards work as a PH-040 shopper surface. Admin is a read-only env poster (no member ledger, no adjust, no fetch error state). Storefront redeem/earn numbers are not live-config-safe. **New:** BFF strips redeem idempotency headers.
