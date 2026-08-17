# Finished production-readiness tasks

**Workstream ID:** `production-readiness-20260816`

Completed tasks are appended here only after verification. This history is
append-only.

## PR-001a / PR-001b / PR-001c — Admin lookup lists (`limit≤100`, no swallow)

**Done:** 2026-08-16  
**Agent:** impl-lookups

### What changed

- Shared server helper `fetchLookupList` (`limit` 1–100, `results ?? []`, errors propagate).
- Product editor loads `/categories`, `/brands`, and `/tags` at `limit=100`. Option catalog is isolated so a catalog failure cannot empty those lists.
- Product form receives SSR tags and TagSelector merges them with `useAllTags` (error UI kept). `listAllTags` no longer assumes `pagination` is present.
- Recipe editor uses the same helper (`limit=100`); no catch-all to `[]`.

### Files

- `apps/frontend/features/admin/shared/fetch-lookup-list.ts`
- `apps/frontend/features/admin/shared/fetch-lookup-list.test.ts`
- `apps/frontend/features/admin/products/components/product-editor-view.tsx`
- `apps/frontend/features/admin/products/components/ProductForm.tsx`
- `apps/frontend/features/admin/products/components/product-form/TagsSection.tsx`
- `apps/frontend/features/admin/products/components/product-form/TagSelector.tsx`
- `apps/frontend/features/admin/products/components/product-form/TagSelector.test.tsx`
- `apps/frontend/features/admin/recipes/components/recipe-editor-view.tsx`
- `apps/frontend/features/admin/tags/api.ts`
- `apps/frontend/features/admin/tags/api.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/products features/admin/recipes features/admin/shared features/admin/tags --passWithNoTests
npx tsc --noEmit
```

- Vitest: 19 files, 65 tests, all passed
- `tsc --noEmit`: clean

### Docs

- `apps/frontend/docs/platform/data-fetching.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/01 Maps/Known gaps.md`
- `obsidian/04 Frontend/Admin Console.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-001a/b/c marked DONE 2026-08-16)

## PR-002a — After successful create/edit, go to `/admin/products`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-nav

Successful product create and edit now toast (existing Persian strings) then `router.push("/admin/products")` + `router.refresh()`.

**Verify:** from `apps/frontend`, `npx vitest run features/admin/products/components/ProductForm --passWithNoTests` — 5 files, 21 tests passed.

**Files:** `ProductForm.tsx`; `ProductForm.behavior.test.tsx`, `.integration.test.tsx`, `.recovery.test.tsx`.

## PR-003c — Store/admin BFF must forward `Idempotency-Key`

**Done:** 2026-08-16 · **Lane:** both · **Agent:** impl-bff

Store and admin BFF copy incoming `Idempotency-Key` onto the upstream fetch
when present. They do not invent a key and do not log it. Shared helper
`pickIdempotencyKeyHeader` is used by both routes.

### Files

- `apps/frontend/lib/api/forward-headers.ts`
- `apps/frontend/lib/api/forward-headers.test.ts`
- `apps/frontend/app/api/store/[...path]/route.ts`
- `apps/frontend/app/api/admin/[...path]/route.ts`

### Verify

From `apps/frontend`:

```
npx vitest run lib/api/forward-headers.test.ts lib/api/admin-proxy-path.test.ts --passWithNoTests
npx tsc --noEmit
```

- Vitest: 2 files, 11 tests, all passed
- `tsc --noEmit`: clean

### Docs

- `apps/backend/docs/architecture/idempotency.md` (§5 now matches the BFF)
- `apps/frontend/docs/platform/bff-and-auth.md`
- `apps/frontend/docs/platform/architecture.md`
- `apps/frontend/docs/features/loyalty.md`
- `apps/frontend/docs/features/wallet.md`
- `apps/frontend/docs/features/gift-cards.md`
- `obsidian/12 Playbooks/Playbook Debug Idempotency.md`
- `obsidian/12 Playbooks/Playbook Idempotency debug.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/02 Architecture/BFF Proxies.md`
- `obsidian/09 Journeys/Journey Account wallet redeem.md`
- `obsidian/09 Journeys/Journey Account wallet top-up.md`
- `obsidian/09 Journeys/Journey Gift card purchase.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003c marked DONE 2026-08-16)

## PR-004a — UNIQUE on `carts.user_id` (add-to-cart 500)

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-cart

`GetOrCreate` already used `ON CONFLICT (user_id)` but `carts.user_id` was only
a non-unique index. New goose migration deduplicates leftover carts, sets
`user_id` `NOT NULL`, drops `idx_carts_user_id`, and adds `uq_carts_user_id`.
Guests stay unsupported. Cart service was not rewritten.

### Files

- `apps/backend/migrations/main/20260816170000_carts_user_id_unique.sql`
- `apps/backend/internal/features/cart/repository.go` (comment only)
- `apps/backend/internal/features/cart/model.go` (comment only)
- `apps/backend/internal/features/cart/repository_constraint_test.go`
- `apps/backend/tests/integration/cart_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/cart/...
```

- `go build ./...`: clean
- `go test ./internal/features/cart/...`: ok (`github.com/tiredbooy/internal/features/cart`)

### Docs

- `apps/backend/docs/api/cart.md`
- `obsidian/05 Domains/Cart and Checkout.md`
- `obsidian/03 Backend/Cart Backend.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-004a marked DONE 2026-08-16)

## PR-004b — Human add-to-cart errors (leftovers)

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-cart-errors

Wishlist single add and cart-line qty/remove now call
`cartMutationErrorMessage` so `OUT_OF_STOCK` / `PRODUCT_UNAVAILABLE` /
`INTERNAL_ERROR` show the mapped Persian, not a generic “افزودن ناموفق بود”
or qty/remove string. `AddToCartButton` was already mapped; not changed.
PR-004d (same wishlist leftover) is covered by this change.

### Files

- `apps/frontend/features/account/wishlist/components/wishlist-view.tsx`
- `apps/frontend/features/account/wishlist/components/wishlist-view.test.tsx`
- `apps/frontend/features/cart/components/cart-lines.tsx`
- `apps/frontend/features/cart/components/cart-lines.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/cart features/account/wishlist --passWithNoTests
```

- 6 files, 21 tests passed (use `./node_modules/.bin/vitest` so aliases + jsdom resolve)

### Docs

- `apps/frontend/docs/features/storefront-commerce.md` § Failures
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/02 Architecture/Error model.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-004b + PR-004d marked DONE 2026-08-16)

## PR-003d — Admin member search + account + paginated ledger

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-loyalty-members

Staff with `customers:read` can search Cellar Club members, open an account
by public UUID (same as `/admin/customers/:id` / wallet credit), and page
the ledger with `id` / `ref_type` / `ref_id`. Lists use `{results, pagination}`.
Adjust (PR-003e) is not mounted. Customer redeem keys unchanged.

### Files

- `apps/backend/internal/features/loyalty/routes.go`
- `apps/backend/internal/features/loyalty/handler.go`
- `apps/backend/internal/features/loyalty/handler_test.go`
- `apps/backend/internal/features/loyalty/service.go`
- `apps/backend/internal/features/loyalty/service_test.go`
- `apps/backend/internal/features/loyalty/repository.go`
- `apps/backend/internal/features/loyalty/model.go`
- `apps/backend/internal/features/loyalty/doc.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/loyalty/...
```

- `go build ./...`: clean
- `go test ./internal/features/loyalty/...`: ok (`github.com/tiredbooy/internal/features/loyalty`)

### Docs

- `apps/backend/docs/api/loyalty.md`
- `apps/backend/docs/architecture/loyalty.md` §4.6
- `obsidian/03 Backend/Loyalty Backend.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/05 Domains/Customers Admin.md`
- `obsidian/09 Journeys/Journey Admin loyalty member lookup.md`
- `obsidian/01 Maps/Journeys MOC.md`
- `obsidian/01 Maps/Known gaps.md`
- `obsidian/Brain/Connect 09 Journeys.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003d marked DONE 2026-08-16)

## PR-003k — `/admin/loyalty` error state

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-loyalty-admin-error

`GET /admin/loyalty/programme` is wrapped in try/catch on the read-only
poster. Failures render `AdminDataErrorState` (Persian copy + «تلاش دوباره»)
instead of a blank RSC error. `requirePermission(customers:read)` stays
outside the catch (403 → `/forbidden`). 401/403 from the programme API are
rethrown; other errors stay on the page. Operator dashboard (PR-003b) is
unchanged.

### Files

- `apps/frontend/app/admin/loyalty/page.tsx`
- `apps/frontend/app/admin/loyalty/page.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run app/admin/loyalty/page.test.ts --passWithNoTests
npx tsc --noEmit
```

- Vitest: 1 file, 6 tests, all passed
- `tsc --noEmit`: clean

### Docs

- `apps/frontend/docs/features/loyalty.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Loyalty FE.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003k marked DONE 2026-08-16)

## PR-003e — Admin adjust (grant/clawback) + actor/note/idempotency

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-loyalty-adjust

Staff with `customers:write` can grant or claw back Cellar Club points via
`POST /admin/users/:userID/loyalty/adjust`. `:userID` is the public UUID
(same as wallet credit). Positive `delta` awards (`admin_adjust`, lifetime
increases). Negative `delta` uses the clawback path and **does not** reduce
`lifetime_points`. Same idempotency key (header or body) replays as **200**;
first apply is **201**. Unknown UUID → `404 USER_NOT_FOUND`. `delta` 0 →
`422`. Actor is encoded on `ref_id` when it fits (`{key}|actor={uuid}`).
No FE adjust UI (PR-003b). Spend `ref_id` scoping unchanged (PR-003g).

### Files

- `apps/backend/internal/features/loyalty/routes.go`
- `apps/backend/internal/features/loyalty/handler.go`
- `apps/backend/internal/features/loyalty/handler_test.go`
- `apps/backend/internal/features/loyalty/service.go`
- `apps/backend/internal/features/loyalty/service_test.go`
- `apps/backend/internal/features/loyalty/repository.go`
- `apps/backend/internal/features/loyalty/model.go`
- `apps/backend/internal/features/loyalty/doc.go`
- `apps/backend/internal/routes/routes.go`
- `apps/backend/internal/routes/idempotency_money_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/loyalty/...
```

- `go build ./...`: clean
- `go test ./internal/features/loyalty/...`: ok (`github.com/tiredbooy/internal/features/loyalty`)

### Docs

- `apps/backend/docs/api/loyalty.md`
- `apps/backend/docs/architecture/loyalty.md` §4.6
- `apps/backend/docs/architecture/idempotency.md`
- `apps/backend/docs/architecture/idempotency-runbook.md`
- `obsidian/03 Backend/Loyalty Backend.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/05 Domains/Customers Admin.md`
- `obsidian/09 Journeys/Journey Admin loyalty member lookup.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003e marked DONE 2026-08-16)

## PR-003g — Scope spend `ref_id` to userID; require key on redeem

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-loyalty-spend-scope

Ledger UNIQUE `(reason, ref_type, ref_id)` is global. Redeem spend
`ref_id` is now `{userID}:idem:{key}` so two customers with the same
client header do not collide. HTTP redeem requires `Idempotency-Key` or
body `idempotency_key` (`400 INVALID_REQUEST` if missing). No nano-suffix
fallback. Award keys and admin adjust (PR-003e) are unchanged. Same user
+ same key still replays.

### Files

- `apps/backend/internal/features/loyalty/service.go`
- `apps/backend/internal/features/loyalty/service_test.go`
- `apps/backend/internal/features/loyalty/handler.go`
- `apps/backend/internal/features/loyalty/handler_test.go`
- `apps/backend/internal/features/loyalty/model.go`
- `apps/backend/internal/features/loyalty/routes.go`
- `apps/backend/internal/features/loyalty/repository.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/loyalty/...
```

- `go build ./...`: clean
- `go test ./internal/features/loyalty/...`: ok

### Docs

- `apps/backend/docs/api/loyalty.md`
- `apps/backend/docs/api/README.md`
- `apps/backend/docs/architecture/loyalty.md` uniqueness + §5
- `apps/backend/docs/architecture/idempotency.md`
- `apps/backend/docs/architecture/idempotency-runbook.md`
- `obsidian/03 Backend/Loyalty Backend.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/09 Journeys/Journey Account wallet redeem.md`
- `obsidian/12 Playbooks/Playbook Debug Idempotency.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003g marked DONE 2026-08-16)

## PR-003b — Admin loyalty dashboard is a real operator surface

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-loyalty-admin-ui

`/admin/loyalty` keeps the env programme snapshot and now includes member
search (`q`, `tier`, `{results, pagination}`). `/admin/loyalty/[userID]`
shows balance, lifetime, tier, a paginated ledger (`id`, delta, reason,
`ref_*`), and an adjust form that mirrors `WalletCreditForm` (UUID, delta,
note, `Idempotency-Key`). Views require `customers:read`. Adjust is hidden
without `customers:write`. No PUT programme (PR-003f). Storefront
`POINT_VALUE` unchanged (PR-003l).

### Files

- `apps/frontend/features/admin/loyalty/types.ts`
- `apps/frontend/features/admin/loyalty/labels.ts`
- `apps/frontend/features/admin/loyalty/validations.ts`
- `apps/frontend/features/admin/loyalty/validations.test.ts`
- `apps/frontend/features/admin/loyalty/api/server.ts`
- `apps/frontend/features/admin/loyalty/components/loyalty-programme-view.tsx`
- `apps/frontend/features/admin/loyalty/components/loyalty-members-view.tsx`
- `apps/frontend/features/admin/loyalty/components/loyalty-members-view.test.tsx`
- `apps/frontend/features/admin/loyalty/components/loyalty-member-detail-view.tsx`
- `apps/frontend/features/admin/loyalty/components/loyalty-member-ledger.tsx`
- `apps/frontend/features/admin/loyalty/components/loyalty-adjust-form.tsx`
- `apps/frontend/features/admin/loyalty/components/loyalty-adjust-form.test.tsx`
- `apps/frontend/app/admin/loyalty/page.tsx`
- `apps/frontend/app/admin/loyalty/page.test.ts`
- `apps/frontend/app/admin/loyalty/[userID]/page.tsx`
- `apps/frontend/app/admin/loyalty/[userID]/page.test.ts`
- `apps/frontend/app/admin/loyalty/[userID]/loading.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run app/admin/loyalty features/admin/loyalty --passWithNoTests
npx tsc --noEmit
```

- Vitest: 5 files, 23 tests, all passed
- `tsc --noEmit`: clean

### Docs

- `apps/frontend/docs/features/loyalty.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Loyalty FE.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/09 Journeys/Journey Admin loyalty member lookup.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003b marked DONE 2026-08-16)

## PR-003h — Earn reliability after Confirm / referral

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-loyalty-earn-reliability

Paid-order earn is no longer fire-and-forget. Confirm writes a
`payment_loyalty_awards` row in the **same TX** as money/stock, then retries
`AwardForOrder` + `OnPaidOrder` after commit. `awarded_at` is set only after
`AwardForOrder` succeeds; leftover rows stay pending for
`ProcessPendingLoyaltyAwards`. Confirm still returns the paid payment if
loyalty fails. Referral `OnPaidOrder` Awards both sides **before** Complete
so a failed grant can be replayed (Award is idempotent per referral id).
Wallet top-up / gift-buy Confirm paths do not write an earn intent.

No cron hook (container left untouched; sweeper is Confirm + exported
`ProcessPendingLoyaltyAwards`). Loyalty package not edited.

### Files

- `apps/backend/migrations/main/20260816180100_payment_loyalty_awards.sql`
- `apps/backend/internal/features/payments/service.go`
- `apps/backend/internal/features/payments/repository.go`
- `apps/backend/internal/features/payments/model.go`
- `apps/backend/internal/features/payments/wire.go`
- `apps/backend/internal/features/payments/doc.go`
- `apps/backend/internal/features/payments/service_test.go`
- `apps/backend/internal/features/payments/service_earn_test.go`
- `apps/backend/internal/features/payments/webhook_test.go`
- `apps/backend/internal/features/referral/service.go`
- `apps/backend/internal/features/referral/wire.go`
- `apps/backend/internal/features/referral/service_test.go`
- `apps/backend/internal/mocks/mocks.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/payments/... ./internal/features/referral/...
```

- `go build ./...`: clean
- `go test ./internal/features/payments/...`: ok
- `go test ./internal/features/referral/...`: ok

### Docs

- `apps/backend/docs/architecture/payments-and-webhooks.md`
- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `apps/backend/docs/architecture/processes-and-jobs.md`
- `obsidian/03 Backend/Payments Backend.md`
- `obsidian/03 Backend/Referral Backend.md`
- `obsidian/03 Backend/Processes and Jobs.md`
- `obsidian/05 Domains/Payments.md`
- `obsidian/05 Domains/Referrals.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/09 Journeys/Journey Payment webhook settle.md`
- `obsidian/09 Journeys/Journey Loyalty first purchase points.md`
- `obsidian/09 Journeys/Journey Referral complete on paid order.md`
- `obsidian/01 Maps/Known gaps.md` (PR-003h in Recently filled; earn-retry on Loyalty earn triggers; PR-003i residual kept)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003h marked DONE 2026-08-16)

## PR-003f — Persist programme rates/tiers + `enabled`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-loyalty-programme

Cellar Club rates, four named tiers, and an `enabled` kill-switch now persist
in dedicated `loyalty_programme` + `loyalty_programme_tiers` tables (not
`site_settings`). Env `LOYALTY_*` seeds the first row and is last-resort
fallback when the row is missing. After seed, Award / Redeem / birthday /
signup / review / `Programme()` load from DB. Award SQL CASE uses live
thresholds (no hardcoded 1000/5000/20000). `enabled=false` skips automated
earn (`result=skip`) and rejects redeem + admin grant/clawback with typed
`LOYALTY_DISABLED` (409). Reads still work. `GET /admin/loyalty/programme`
adds `enabled`; `config_source` is `"db"` and `editable` is `true` when
served from the table. `PUT /admin/loyalty/programme` is `customers:write`
(same group as adjust). Payment Confirm and referral Complete were not
changed.

### Files

- `apps/backend/migrations/main/20260816180000_loyalty_programme.sql`
- `apps/backend/internal/features/loyalty/model.go`
- `apps/backend/internal/features/loyalty/repository.go`
- `apps/backend/internal/features/loyalty/service.go`
- `apps/backend/internal/features/loyalty/service_test.go`
- `apps/backend/internal/features/loyalty/handler.go`
- `apps/backend/internal/features/loyalty/handler_test.go`
- `apps/backend/internal/features/loyalty/model_test.go`
- `apps/backend/internal/features/loyalty/routes.go`
- `apps/backend/internal/features/loyalty/doc.go`
- `apps/backend/pkg/apperr/apperr.go`
- `apps/backend/pkg/response/codes.go`
- `apps/backend/pkg/response/codes_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/loyalty/...
```

- `go build ./...`: clean
- `go test ./internal/features/loyalty/...`: ok

### Docs

- `apps/backend/docs/api/loyalty.md`
- `apps/backend/docs/api/README.md`
- `apps/backend/docs/architecture/loyalty.md`
- `apps/backend/docs/architecture/error-messages.md`
- `apps/backend/docs/conventions.md`
- `obsidian/03 Backend/Loyalty Backend.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/09 Journeys/Journey Admin loyalty member lookup.md`
- `obsidian/02 Architecture/Error model.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003f marked DONE 2026-08-16)

## PR-003i — Call `ClawbackOrderEarn` on full `refunded` status

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-loyalty-clawback-refund

`UpdateOrderStatus` now calls `ClawbackOrderEarn` after a successful write
when status is full `refunded` (balance only, not lifetime). Not called for
`partially_refunded`, cancel, or other statuses. Nil clawback skips (tests).
If clawback fails after the status write committed: log the cause and return
a wrapped error so the operator knows points may remain. Retry is safe
(helper is idempotent). Not a refund saga (no wallet / restock / coupon —
PR-020d).

### Files

- `apps/backend/internal/features/orders/service.go`
- `apps/backend/internal/features/orders/wire.go`
- `apps/backend/internal/features/orders/service_test.go`
- `apps/backend/internal/features/orders/doc.go`
- `apps/backend/internal/bootstrap/container.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/orders/...
```

- `go build ./...`: clean
- `go test ./internal/features/orders/...`: ok

### Docs

- `apps/backend/docs/architecture/loyalty.md`
- `apps/backend/docs/api/orders.md`
- `apps/backend/docs/api/loyalty.md`
- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/03 Backend/Orders Backend.md`
- `obsidian/03 Backend/Loyalty Backend.md`
- `obsidian/09 Journeys/Journey Admin refund restock.md`
- `obsidian/09 Journeys/Journey Loyalty first purchase points.md`
- `obsidian/01 Maps/Known gaps.md` (PR-003i in Recently filled; clawback wired on Loyalty earn triggers; PR-003j residual kept)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003i marked DONE 2026-08-16)

## PR-003j — Customer ledger pagination + `id`/`ref_type`/`ref_id`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-loyalty-customer-ledger

Customer `GET /loyalty/transactions` is paginated `{results, pagination}`
(`page` ≥ 1, `limit` 1–100, default 20). Each row includes `id`, `ref_type`,
`ref_id` plus `delta` / `reason` / `created_at` (same shape as the admin
member ledger). Invalid query is `400 INVALID_QUERY` — not an empty list.
Storefront `listLoyaltyTransactions` reads the new envelope; `useLoyaltyTransactions`
still returns the row array so `/account/rewards` does not go blank.

### Files

- `apps/backend/internal/features/loyalty/model.go`
- `apps/backend/internal/features/loyalty/repository.go`
- `apps/backend/internal/features/loyalty/service.go`
- `apps/backend/internal/features/loyalty/handler.go`
- `apps/backend/internal/features/loyalty/doc.go`
- `apps/backend/internal/features/loyalty/service_test.go`
- `apps/backend/internal/features/loyalty/handler_test.go`
- `apps/backend/internal/features/loyalty/model_test.go`
- `apps/frontend/features/loyalty/types.ts`
- `apps/frontend/features/loyalty/api.ts`
- `apps/frontend/features/loyalty/hooks.ts`
- `apps/frontend/features/loyalty/api.test.ts`
- `apps/frontend/features/admin/loyalty/types.ts` (comment only)

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/loyalty/...
```

From `apps/frontend`:

```
npx vitest run features/loyalty --passWithNoTests
```

### Docs

- `apps/backend/docs/api/loyalty.md`
- `apps/backend/docs/architecture/loyalty.md`
- `apps/frontend/docs/features/loyalty.md`
- `obsidian/03 Backend/Loyalty Backend.md`
- `obsidian/04 Frontend/Loyalty FE.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/09 Journeys/Journey Loyalty first purchase points.md`
- `obsidian/01 Maps/Known gaps.md` (PR-003j Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003j marked DONE 2026-08-16)

## PR-003m — Checkout: link to rewards; no unpaid earn copy

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-checkout-rewards-copy

Checkout payment step now has a discreet Cellar Club section: honest copy
that points (if any) land after **successful payment**, plus a link to
`/account/rewards`. No client `floor(total/divisor)`, no invented earn
amount on unpaid checkout.

### Files

- `apps/frontend/features/checkout/components/checkout-payment-step.tsx`
- `apps/frontend/features/checkout/components/checkout-state.test.tsx`
- `apps/frontend/features/checkout/components/form-accessibility.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/checkout --passWithNoTests
```

- Vitest: 3 files, 17 tests, all passed

### Docs

- `apps/frontend/docs/features/loyalty.md`
- `apps/frontend/docs/features/storefront-commerce.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/09 Journeys/Journey Loyalty first purchase points.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/04 Frontend/Loyalty FE.md`
- `obsidian/05 Domains/Cart and Checkout.md`
- `obsidian/01 Maps/Known gaps.md` (PR-003m Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003m marked DONE 2026-08-16)

## PR-003l — Stop hardcoding redeem Toman (`POINT_VALUE = 1000`)

**Done:** 2026-08-16 · **Lane:** fe (+ small BE field) · **Agent:** impl-loyalty-redeem-rate

`GET /loyalty` now includes additive `redeem_value` from the persisted
programme (`loadConfig` / `cfg.RedeemValue`; env fallback when no DB row).
`/account/rewards` deleted `POINT_VALUE = 1000` and previews
`points * redeem_value` only when `redeem_value > 0`. Missing/≤0 shows a dash.

### Files

- `apps/backend/internal/features/loyalty/model.go`
- `apps/backend/internal/features/loyalty/service.go`
- `apps/backend/internal/features/loyalty/model_test.go`
- `apps/backend/internal/features/loyalty/service_test.go`
- `apps/backend/internal/features/loyalty/handler_test.go`
- `apps/frontend/features/loyalty/types.ts`
- `apps/frontend/features/loyalty/redeem-preview.ts`
- `apps/frontend/features/loyalty/redeem-preview.test.ts`
- `apps/frontend/features/loyalty/components/rewards-view.tsx`
- `apps/frontend/features/loyalty/components/rewards-view.test.tsx`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/loyalty/...
```

From `apps/frontend`:

```
npx vitest run features/loyalty --passWithNoTests
```

### Docs

- `apps/backend/docs/api/loyalty.md`
- `apps/backend/docs/architecture/loyalty.md`
- `apps/frontend/docs/features/loyalty.md`
- `obsidian/04 Frontend/Loyalty FE.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/09 Journeys/Journey Account wallet redeem.md`
- `obsidian/01 Maps/Known gaps.md` (PR-003l Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-003l marked DONE 2026-08-16)

## PR-010b — Do not collapse cart SQL errors to bare INTERNAL_ERROR

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-cart-error-wrap

Unexpected cart repo/SQL errors are logged (`slog.Error` with `op` + cause)
then returned as `apperr.ErrInternal`. Public 500 stays the generic
`INTERNAL_ERROR` envelope — no SQL in the body. Typed mappings
(`PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `OUT_OF_STOCK`, `NOT_FOUND`)
are unchanged. Failures are not swallowed into empty carts.

### Files

- `apps/backend/internal/features/cart/service.go`
- `apps/backend/internal/features/cart/service_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/cart/...
```

- `go build ./...`: clean
- `go test ./internal/features/cart/...`: PASS (including GetOrCreate/GetItems/AddItem repo-error → `ErrInternal`, typed stock/not-found still mapped)

### Docs

- `apps/backend/docs/architecture/error-messages.md`
- `apps/backend/docs/api/cart.md`
- `obsidian/03 Backend/Cart Backend.md`
- `obsidian/02 Architecture/Error model.md`
- `obsidian/01 Maps/Known gaps.md` (PR-010b Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-010b marked DONE 2026-08-16)

## PR-010a — `EnsureForVariant` on aggregate / legacy variant create

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-inventory-ensure-variant

Editor aggregate create/update and legacy `POST /admin/products` inline
variants now insert a **zero-stock inventory row** in the same TX via
package-level `inventory.EnsureForVariantTx`. Standalone
`variant.Service.Create` was already doing this and was left unchanged.
Ensure is idempotent (`ON CONFLICT DO NOTHING`); a failed ensure aborts
the product TX. No invented stock quantities.

### Files

- `apps/backend/internal/features/inventory/repository.go`
- `apps/backend/internal/features/inventory/ensure_test.go`
- `apps/backend/internal/features/inventory/doc.go`
- `apps/backend/internal/features/catalog/product/aggregate_repository.go`
- `apps/backend/internal/features/catalog/product/repository.go`
- `apps/backend/tests/integration/product_aggregate_test.go`
- `apps/backend/tests/integration/product_test.go`
- `apps/backend/tests/integration/seed_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/catalog/product/... ./internal/features/catalog/variant/... ./internal/features/inventory/...
```

Integration (when `TEST_DATABASE_URL` is set):

```
go test -tags=integration ./tests/integration/ -run 'TestProductAggregate|TestProductCreateEnsures'
```

### Docs

- `apps/backend/docs/architecture/inventory.md`
- `apps/backend/docs/api/products.md`
- `apps/backend/docs/api/variants.md`
- `obsidian/05 Domains/Inventory.md`
- `obsidian/05 Domains/Catalogue.md`
- `obsidian/03 Backend/Inventory Backend.md`
- `obsidian/09 Journeys/Journey Admin publish product.md`
- `obsidian/01 Maps/Known gaps.md` (PR-010a Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-010a marked DONE 2026-08-16)

## PR-010c — Refuse add-to-cart when parent product is inactive

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-cart-inactive-parent

`AddItem` and bulk `AddItems` now look up the parent product via
`GetByIDForAdmin` after the variant. Missing parent → `ErrProductNotFound`.
Inactive parent → `ErrProductUnavailable` (same as an inactive variant) so
a line cannot insert then vanish on `GetItems` (`p.is_active = true`).
Bulk add skips those lines as `unavailable` rather than failing the request.
Unexpected SQL is still wrapped through `internal(op, err)`.

### Files

- `apps/backend/internal/features/cart/service.go`
- `apps/backend/internal/features/cart/service_test.go`
- `apps/backend/internal/features/cart/wire.go`
- `apps/backend/internal/bootstrap/container.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/cart/...
```

- `go build ./...`: clean
- `go test ./internal/features/cart/...`: PASS (inactive parent → `ErrProductUnavailable` with no AddItem repo call; active parent still succeeds; bulk add skips inactive parent as `unavailable`)

### Docs

- `apps/backend/docs/architecture/error-messages.md`
- `obsidian/03 Backend/Cart Backend.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/01 Maps/Known gaps.md` (PR-010c Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-010c marked DONE 2026-08-16)

## PR-010d — Hydrate cart line `options`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-cart-hydrate-options

`GetItems` now loads variant options for every cart line in one extra query
(`product_variants_options` → `option_values` → `option_types`, `ANY($1)`).
`CartItemResponse.Options` uses the existing `models.OptionValueResponse`
shape. Variants with no options stay empty/omitted. Active-product/variant
filters on the line query are unchanged.

### Files

- `apps/backend/internal/features/cart/repository.go`
- `apps/backend/internal/features/cart/repository_items_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/cart/...
```

### Docs

- `apps/backend/docs/architecture/domain-map.md`
- `obsidian/05 Domains/Cart and Checkout.md`
- `obsidian/03 Backend/Cart Backend.md`
- `obsidian/01 Maps/Known gaps.md` (PR-010d Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-010d marked DONE 2026-08-16)

## PR-010e — Brand PATCH title uniqueness must exclude self

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-brand-title-self

`brand.Repository.ExistsByTitle` now takes `excludeID` and uses
`WHERE title = $1 AND ($2 = 0 OR id <> $2)` (same pattern as tags).
Create passes `0`; Update passes the brand id. Same-title PATCH is no
longer a self-conflict; PATCH to another brand's title still returns
`models.ErrAlreadyExists` (`409 CONFLICT`).

### Files

- `apps/backend/internal/features/catalog/brand/repository.go`
- `apps/backend/internal/features/catalog/brand/service.go`
- `apps/backend/internal/features/catalog/brand/service_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/catalog/brand/...
```

- `go build ./...`: clean
- `go test ./internal/features/catalog/brand/...`: PASS (same-title Update does not return `ErrAlreadyExists`; other-brand title does; Create still excludes `0`)

### Docs

- `apps/backend/docs/api/brands.md`
- `obsidian/05 Domains/Catalogue.md`
- `obsidian/01 Maps/Known gaps.md` (PR-010e Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-010e marked DONE 2026-08-16)

## PR-004c — Document auth-required cart as intended

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-docs-auth-cart

Store BFF + Go cart stay login-gated. Guests get `401`, not a cookie /
anonymous basket, and there is no merge-on-login. Documented as a product
decision (explicit non-goal unless product asks), not a missing feature.
The founder add-to-cart 500 after login remains PR-004a (`UNIQUE` on
`carts.user_id`), not a guest-cart gap. No guest cart implemented. No
Persian UI change — guest copy already sends shoppers to `/login`.

### Files

- `apps/frontend/docs/features/storefront-commerce.md`
- `apps/frontend/docs/platform/bff-and-auth.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/13 Surfaces/Surface Storefront.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-004c marked DONE 2026-08-16)

### Verify

Docs-only. Cited `apps/backend/docs/api/cart.md` Auth-only / one-cart-per-user
invariants (file not rewritten). Store proxy returns `401 SESSION_EXPIRED`
without a session; `cart` is on the store allowlist, not `/api/public`.
`AddToCartButton` / `CartView` / `CartButton` login-wall guests and do not
fetch. No UI string claims guests have a cart.

## PR-011d — Category picker: tree / parent labels

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-category-picker-tree

Product form category `SearchableIdSelect` labels walk `parent_id` on the
SSR lookup page (`Parent / Child`). Missing parents (page of 100) and
`parent_id` cycles fall back to the category title. IDs are unchanged.
Brand select stays a flat title list. No extra tree fetch.

### Files

- `apps/frontend/features/admin/products/components/product-form/category-select-options.ts`
- `apps/frontend/features/admin/products/components/product-form/category-select-options.test.ts`
- `apps/frontend/features/admin/products/components/product-form/GeneralInfoSection.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/products/components/product-form --passWithNoTests
```

- 5 files, 15 tests, all passed (including 6 new label-builder cases: root, child, nested, missing parent, cycle, self-parent)

### Docs

- `apps/frontend/docs/features/domain-map.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/01 Maps/Known gaps.md` (PR-011d Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-011d marked DONE 2026-08-16)

## PR-010f — Document `GET /admin/products` + cart bulk + public GET /tags

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-docs-catalog-cart

Docs only. Routes were already mounted; API pages omitted them. No Go/TS
behavior change. `brands.md` left to PR-010e.

Documented:

- `GET /admin/products` — staff list includes inactive/drafts; same
  `{results, pagination}` / `ProductListItem` as public `GET /products`;
  honors `ProductFilter` (`is_active`, search, page, `limit` max 100).
- `POST /cart/items/bulk` — `AddCartItemsReq` / `BulkAddResult` (`cart`,
  `added`, `skipped[]` reasons `invalid|not_found|unavailable|out_of_stock`).
  Existing PR-004a / PR-010b cart invariants left as-is.
- Public `GET /tags` is the only tag list (`limit≤100`). There is **no**
  `GET /admin/tags`; admin typeahead uses the public list.

### Files

- `apps/backend/docs/api/products.md`
- `apps/backend/docs/api/cart.md`
- `apps/backend/docs/api/tags.md`
- `obsidian/03 Backend/Backend API.md`
- `obsidian/07 Docs Bridge/Docs Bridge Backend.md`
- `obsidian/01 Maps/Known gaps.md` (PR-010f Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-010f marked DONE 2026-08-16)

### Verify

Docs-only. Grepped live mounts vs docs:

- `product/routes.go` `read.GET("/products", ListAdminProducts)`
- `cart/routes.go` `POST /cart/items/bulk` → `AddItems`
- `tag/routes.go` `GET /tags` public; admin is `POST/PATCH/DELETE` only

## PR-011b — Product editor respects `PRODUCTS_WRITE`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-product-editor-write

`/admin/products/[id]` stays on `requirePermission(PRODUCTS_READ)` so
read-only staff can open the editor. The page computes
`canWrite = can(session, PRODUCTS_WRITE)` and passes it through
`ProductEditView` → `ProductForm`. Create still requires write at the page
and always passes `canWrite`. When `canWrite` is false the form is
view-only: submit hidden, image upload and mutating variant tools
disabled, `saveProductAggregate` is not called, Persian “فقط مشاهده” hint
shown. The page is not 403’d for readers.

### Files

- `apps/frontend/app/admin/products/[id]/page.tsx`
- `apps/frontend/features/admin/products/components/product-editor-view.tsx`
- `apps/frontend/features/admin/products/components/ProductForm.tsx`
- `apps/frontend/features/admin/products/components/product-form/sidebar/FormHeaderBar.tsx`
- `apps/frontend/features/admin/products/components/product-form/sidebar/MobileActionBar.tsx`
- `apps/frontend/features/admin/products/components/ProductForm.behavior.test.tsx`
- `apps/frontend/features/admin/products/components/product-form/sidebar/ProductActionBars.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/products/components/ProductForm --passWithNoTests
```

- 5 files, 22 tests, all passed (including `canWrite={false}` does not submit)
- `ProductActionBars.test.tsx`: 2 tests passed (save hidden when read-only)

### Docs

- `apps/frontend/docs/platform/rbac.md`
- `obsidian/09 Journeys/Journey Admin publish product.md`
- `obsidian/02 Architecture/RBAC.md`
- `obsidian/05 Domains/Catalogue.md`
- `obsidian/01 Maps/Known gaps.md` (PR-011b Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-011b marked DONE 2026-08-16)

## PR-100a — Install + Rumera chart kernel

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** charts-kernel

Shared TanStack Charts kernel at `apps/frontend/lib/charts/`. Feature charts
are unchanged (`Charts.tsx` / monitoring / `package.json` deps left alone).
`recharts` stays in `optimizePackageImports` until PR-100f.

### What changed

- Cellar theme: gold `oklch(0.72 0.15 75)`, blue `oklch(0.62 0.16 250)`,
  wine slice, grid `var(--border)`, `--ts-chart-*` palette vars.
- `faTick` / `faMoneyTick` («م» millions) / `faToman` wrap `faNum`.
- `<RumeraChart definition ariaLabel />` — RTL host, forwards Chart props.
- Reduced motion: `Chart` has no motion prop. Kernel exports
  `rumeraSvgAnimation` (`respectReducedMotion: true`) and
  `usePrefersReducedMotion`. Optional springs stay on
  `@tanstack/charts/motion`.
- `next.config.ts`: added `@tanstack/charts` to `optimizePackageImports`.

### Files

- `apps/frontend/lib/charts/theme.ts`
- `apps/frontend/lib/charts/format.ts`
- `apps/frontend/lib/charts/format.test.ts`
- `apps/frontend/lib/charts/rumera-chart.tsx`
- `apps/frontend/lib/charts/index.ts`
- `apps/frontend/next.config.ts`

### Verify

From `apps/frontend`:

```
npx vitest run lib/charts --passWithNoTests
npx tsc --noEmit
```

- Vitest: 1 file, 3 tests, all passed
- `tsc --noEmit`: clean

### Docs

- `apps/frontend/docs/features/admin-console.md` (Admin charts)
- `apps/frontend/docs/platform/architecture.md` (`lib/charts/`)
- `apps/frontend/docs/platform/design-system.md` (`faTick` / `faMoneyTick`)
- `obsidian/04 Frontend/Admin Analytics.md`
- `obsidian/04 Frontend/Design System.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-100a marked DONE 2026-08-16)

## PR-100c — Orders bar chart

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** charts-orders

Admin analytics daily-order series is a TanStack `barY` (`OrdersBarChart`)
in blue `oklch(0.62 0.16 250)`. Data is `{ day, orders }`. `AnalyticsRevenueCharts`
imports `OrdersBarChart` from the new file and `RevenueAreaChart` from its
sibling (not from `Charts.tsx`). ChartCard chrome, empty, and error states
are unchanged. `RevenueChartSection.tsx` and `Charts.tsx` body were not edited.

Ticks/tooltips use `faNum` / `faTick`. Host is `RumeraChart` (`dir="rtl"`).
`svgAnimation` is off when `prefers-reduced-motion` matches.

### Files

- `apps/frontend/features/admin/analytics/components/OrdersBarChart.tsx`
- `apps/frontend/features/admin/analytics/components/OrdersBarChart.test.ts`
- `apps/frontend/features/admin/analytics/components/AnalyticsRevenueCharts.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/analytics/components/OrdersBarChart --passWithNoTests
npx tsc --noEmit
```

- Vitest: 1 file, 1 test passed (`formatOrdersTooltip` Persian count)
- `tsc --noEmit`: clean

### Docs

- `apps/frontend/docs/features/admin-console.md` (Analytics charts)
- `apps/frontend/docs/platform/design-system.md`
- `obsidian/04 Frontend/Admin Analytics.md`
- `obsidian/13 Surfaces/Surface Admin.md`
- `obsidian/01 Maps/Known gaps.md` (PR-100c Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-100c marked DONE 2026-08-16)

## PR-011a — Product list server pagination + search

**Done:** 2026-08-16 · **Lane:** both · **Agent:** impl-product-list-pagination

Admin `/admin/products` no longer fetches `limit: 100` once and client-filters
that first page. The route reads `q`/`search`, `page`, optional `is_active`,
and `sort` / `sortBy`+`orderBy`, then calls existing `GET /admin/products`
(`fetchAdminProducts`, `limit≤100`). The pager uses `pagination.total_items`,
`total_pages`, and `page`. DataTable client search is gone; status is sent as
`is_active`; missing-weight copy is scoped to the current page. Create stays
`PRODUCTS_WRITE`. Envelope unchanged — FE-only.

### Files

- `apps/frontend/app/admin/products/page.tsx`
- `apps/frontend/features/admin/products/products-list-params.ts`
- `apps/frontend/features/admin/products/products-list-params.test.ts`
- `apps/frontend/features/admin/products/components/products-list-view.tsx`
- `apps/frontend/features/admin/products/components/products-list-view.test.tsx`
- `apps/frontend/features/admin/products/components/ProductsTable.tsx`
- `apps/frontend/features/admin/products/components/ProductsTable.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/products --passWithNoTests
npx tsc --noEmit
```

- Vitest: 15 files, 64 tests, all passed
- `tsc --noEmit`: clean

### Docs

- `apps/frontend/docs/features/admin-console.md` (Product list section)
- `obsidian/04 Frontend/Admin Console.md` (list-pagination paragraph)
- `obsidian/04 Frontend/Search FE.md`
- `obsidian/05 Domains/Catalogue.md`
- `obsidian/09 Journeys/Journey Admin publish product.md`
- `obsidian/01 Maps/Known gaps.md` (PR-011a Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-011a marked DONE 2026-08-16)

## PR-100d — Order-status donut

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** charts-donut

Admin home order-status mix is a TanStack Charts donut (`pie` + `polar` +
`radialArc` + center `radialText`). `OrderStatusSection` imports
`DonutChart` / `DonutLegend` from `./DonutChart` (ChartCard still from
`./Charts`). Center total and Persian legend stay. `Charts.tsx` was not
edited.

### What changed

- New `DonutChart.tsx` uses catalog center-donut marks, kernel
  `RumeraChart` / `rumeraSvgAnimation` / `SLICE_COLORS` (lock-step with
  `Charts.tsx`), RTL host, `faNum` tooltips (`وضعیت · عدد`).
- Center `radialText` is the Persian total plus optional «سفارش».
- `DonutLegend` keeps coloured rows and `faNum` values.
- Empty / error cards in `OrderStatusSection` are unchanged.

### Files

- `apps/frontend/features/admin/analytics/components/DonutChart.tsx`
- `apps/frontend/features/admin/analytics/components/DonutChart.test.tsx`
- `apps/frontend/features/admin/analytics/components/OrderStatusSection.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/analytics/components/DonutChart.test.tsx --passWithNoTests
```

- 1 file, 1 test passed (Persian legend labels, `faNum` values, `SLICE_COLORS`)
- `tsc --noEmit`: no errors in the new donut files

### Docs

- `apps/frontend/docs/features/admin-console.md` (Analytics charts table + donut)
- `obsidian/04 Frontend/Admin Analytics.md`
- `obsidian/01 Maps/Known gaps.md` (PR-100d Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-100d marked DONE 2026-08-16)

## PR-100e — Monitoring time-series

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** charts-monitoring

Replaced the three Recharts `AreaChart`s on `/admin/monitoring` (req/s, 5xx %,
p95 ms) with TanStack Charts `areaY` + `lineY` via `RumeraChart`. Local
`ChartCard` empty copy is unchanged («داده‌ای برای این بازه نیست»). X ticks
and point labels use `fa-IR` clock times; series paint uses CSS vars
(`--primary`, `--destructive`, `--chart-2`). Analytics `Charts.tsx` was not
edited. `MonitoringCharts.tsx` had no existing tests.

### Files

- `apps/frontend/features/admin/monitoring/components/MonitoringCharts.tsx`

### Verify

From `apps/frontend`:

```
npx eslint features/admin/monitoring/components/MonitoringCharts.tsx
npx vitest run features/admin/monitoring --passWithNoTests
npx tsc --noEmit
```

- ESLint: clean
- Vitest: 1 file, 2 tests passed (`queries.test.ts`; no chart component tests)
- `tsc --noEmit`: no errors in this file (pre-existing `ProductsTable.test.tsx` TS2698 only)

### Docs

- `apps/frontend/docs/features/api-monitoring.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/09 Journeys/Journey Monitor API health.md`
- `obsidian/06 Ops/Observability.md`
- `obsidian/01 Maps/Known gaps.md` (PR-100e Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-100e marked DONE 2026-08-16)

## PR-100b — Revenue area chart

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** charts-revenue

Replaced the dashboard 30-day revenue **area** chart with TanStack Charts
`areaY` + `lineY` (gold `CHART_GOLD`). New `RevenueAreaChart.tsx` uses the
PR-100a kernel (`RumeraChart`, `rumeraChartTheme`, `rumeraSvgAnimation`,
`faMoneyTick` / `faToman`). `RevenueChartSection` keeps ChartCard chrome
and imports the new file. Data shape stays `{ day, revenue }`. Height
`h-64`. Persian tooltip via `faToman`. RTL + reduced-motion via the kernel.
`AnalyticsRevenueCharts.tsx` and `Charts.tsx` were not edited here (sibling
already points the analytics card at the new file).

### Files

- `apps/frontend/features/admin/analytics/components/RevenueAreaChart.tsx`
- `apps/frontend/features/admin/analytics/components/RevenueAreaChart.test.ts`
- `apps/frontend/features/admin/analytics/components/RevenueChartSection.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/analytics/components/RevenueAreaChart.test.ts --passWithNoTests
```

- 1 file, 2 tests passed (Persian tooltip; gold scene / `faMoneyTick` axis)
- `tsc --noEmit`: no errors in the new revenue files (pre-existing
  `ProductsTable.test.tsx` TS2698 only)

### Docs

- `apps/frontend/docs/features/admin-console.md` (Analytics charts table + revenue ticks)
- `obsidian/04 Frontend/Admin Analytics.md`
- `obsidian/01 Maps/Known gaps.md` (PR-100b Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-100b marked DONE 2026-08-16)

## PR-100f — Rankings + delete recharts

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** charts-rankings-cleanup

Top-product and event-mix rankings are TanStack `barX` (`HorizontalBars`)
via `RumeraChart`. Largest-first, wine/blue tokens, `faNum` ticks, Persian
tooltip, `dir="rtl"`, reduced-motion. Product bars with `href` navigate on
select. Empty/error cards unchanged.

Siblings had already moved every series consumer off the Recharts
implementations in `Charts.tsx`. That file is now `ChartCard` +
`SLICE_COLORS` + a `HorizontalBars` re-export. `from "recharts"` /
`@/components/ui/chart` grep is clean, so `recharts` is uninstalled and
`components/ui/chart.tsx` re-exports `RumeraChart`. `next.config.ts`
dropped `recharts` from `optimizePackageImports`.

### Files

- `apps/frontend/features/admin/analytics/components/HorizontalBars.tsx`
- `apps/frontend/features/admin/analytics/components/HorizontalBars.test.ts`
- `apps/frontend/features/admin/analytics/components/AnalyticsTopProducts.tsx`
- `apps/frontend/features/admin/analytics/components/AnalyticsEventBreakdown.tsx`
- `apps/frontend/features/admin/analytics/components/Charts.tsx` (re-exports + chrome)
- `apps/frontend/components/ui/chart.tsx`
- `apps/frontend/package.json` / `package-lock.json` (`recharts` removed)
- `apps/frontend/next.config.ts` (`optimizePackageImports`)

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/analytics/components/HorizontalBars features/admin/analytics/components/DonutChart features/admin/analytics/components/OrdersBarChart features/admin/analytics/components/RevenueAreaChart --passWithNoTests
npx tsc --noEmit
```

- Vitest: 4 files, 7 tests passed (including 3 ranking tests)
- `tsc --noEmit`: clean
- Grep `from "recharts"` / `@/components/ui/chart`: 0 hits

### Docs

- `apps/frontend/docs/features/admin-console.md` (rankings + recharts removal)
- `obsidian/04 Frontend/Admin Analytics.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-100f marked DONE 2026-08-16)

## PR-010g — Optional lookup cap >100

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-lookup-cap-close

**Not implemented / not required.** The API `limit` max stays 100. TASKS
said a higher cap was only needed if FE refused to page at 100. FE already
pages: PR-001a–c shared `fetchLookupList` (`limit≤100`) and PR-011a admin
product list. Raising `httpx.validBaseQuery` / `models.BaseFilter` would
not fix PR-001 and is not needed. No Go/TS change. `httpx/bind.go`,
`models/filter.go`, and `products.md` were not edited.

### Why the cap was not raised

- Admin typeahead / lookups request `limit≤100` and page.
- FE does not refuse to page at 100.
- PR-001 empty selects were `limit=200` → `400 INVALID_QUERY` + swallow;
  already fixed by paging, not by raising the bind cap.
- Envelope `{results, pagination}` stays unchanged.

### Files

- `apps/backend/docs/architecture/domain-map.md`
- `obsidian/05 Domains/Catalogue.md`
- `obsidian/01 Maps/Known gaps.md` (PR-010g Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-010g marked DONE 2026-08-16)

### Verify

Docs-only. No bind/filter/product-code change.

## PR-011e — Product list empty/error states

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-product-list-empty

PR-011a already shipped the leftover: `ProductsListResults` catches
`fetchAdminProducts` (except 401/403) and renders `AdminDataErrorState`
(«دریافت محصولات ناموفق بود», built-in `router.refresh` retry) instead of
a fake empty table or only `app/admin/error.tsx`. Zero results still split
empty catalogue («هنوز محصولی ثبت نشده است») from a filtered miss
(«محصولی با این فیلترها یافت نشد»). No new mock data. This task added the
rejection test and dual-doc.

### Files

- `apps/frontend/features/admin/products/components/products-list-view.tsx` (verified; no leftover)
- `apps/frontend/features/admin/products/components/products-list-view.test.tsx`
- `apps/frontend/docs/features/admin-console.md` (product list empty/error paragraph)
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/12 Playbooks/Playbook Add admin module.md`
- `obsidian/01 Maps/Known gaps.md` (PR-011e Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-011e marked DONE 2026-08-16)

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/products/components/products-list-view --passWithNoTests
```

- Vitest: 1 file, 3 tests passed (filters + pager; filtered-empty; fetch rejection ≠ empty-catalogue)

## PR-040f — CORS Allow-Headers include `Idempotency-Key`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-cors-idempotency

`Access-Control-Allow-Headers` now includes `Idempotency-Key` so a browser
preflight for money POSTs (orders / redeem / wallet credit) from an allowed
origin does not fail after the BFF already forwards the header (PR-003c).

### Files

- `apps/backend/internal/middlewares/security.go`
- `apps/backend/internal/middlewares/security_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/middlewares/...
```

- `go build ./...`: clean
- `go test ./internal/middlewares/...`: PASS (`TestCORS_OPTIONSAllowHeadersIncludesIdempotencyKey`)

### Docs

- `apps/backend/docs/conventions.md`
- `apps/backend/docs/architecture/idempotency.md`
- `obsidian/02 Architecture/BFF Proxies.md`
- `obsidian/11 Decisions/ADR Idempotency platform.md`
- `obsidian/12 Playbooks/Playbook Idempotency debug.md`
- `obsidian/01 Maps/Known gaps.md` (CORS allows Idempotency-Key (PR-040f))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-040f marked DONE 2026-08-16)

## PR-020h — `MarkAsPaid` sets `paid_at`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-order-paid-at

`orders.MarkAsPaid` now stamps `paid_at = COALESCE(paid_at, NOW())` in the
same pending→paid UPDATE as `status='paid'` and `updated_at`. Existing
`paid_at` is kept. Status-machine policy unchanged (PR-020l). No wallet
debit or refund.

### Files

- `apps/backend/internal/features/orders/repository.go` (`MarkAsPaid` / `markAsPaidSQL`)
- `apps/backend/internal/features/orders/mark_as_paid_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/orders/...
```

- `go build ./...`: clean
- `go test ./internal/features/orders/...`: ok (includes `TestMarkAsPaidSQLSetsPaidAt`)

### Docs

- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/12 Playbooks/Playbook Debug Webhook.md`
- `obsidian/09 Journeys/Journey Payment webhook settle.md`
- `obsidian/01 Maps/Known gaps.md` (MarkAsPaid sets paid_at (PR-020h))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020h marked DONE 2026-08-16)

## PR-053a — Do not MarkNotified unless alert email actually sent

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-alert-notify-gate

`alert_check_job` no longer stamps `notified_at` when `mailer == nil` or
when `Send` fails. Nil mailer logs and returns without marking so the next
tick can retry. A send error skips that id only; successes in the same
batch are still marked. The job does not invent emails.

### Files

- `apps/backend/internal/corn/alert_check_job.go`
- `apps/backend/internal/corn/alert_check_job_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/corn/...
```

- `go build ./...`: clean
- `go test ./internal/corn/...`: PASS — `TestAlertCheckJob_MarkNotifiedOnlyAfterSend` (mailer nil never marks; send error does not mark that id; send ok marks that id; mixed batch marks only successes)

### Docs

- `apps/backend/docs/architecture/processes-and-jobs.md`
- `obsidian/05 Domains/Product Alerts.md`
- `obsidian/09 Journeys/Journey Product alert notify.md`
- `obsidian/03 Backend/Product Alerts Backend.md`
- `obsidian/03 Backend/Processes and Jobs.md`
- `obsidian/12 Playbooks/Playbook Debug Product alert notify.md`
- `obsidian/01 Maps/Playbooks MOC.md`
- `obsidian/01 Maps/Known gaps.md` (Alert cron marks notified only after email send (PR-053a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-053a marked DONE 2026-08-16)

## PR-005c — `PATCH /subscriptions/:id` accept `address_id`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-sub-address-patch

`PATCH /subscriptions/:id` accepts optional `address_id` (alone or with a
lifecycle `action`). Address-only skips pause/resume/cancel/skip. Combined
bodies apply the action first, then persist ship-to on the subscription row.
`address_id` must be `>= 1`. Missing subscription → `NOT_FOUND` (not 500).
Unknown address FK → `INVALID_REQUEST`. No payment / auto-charge (not PH-043c).
Address-book ownership stays PR-040d (create). FE picker is PR-035b.

### Files

- `apps/backend/internal/features/subscription/model.go`
- `apps/backend/internal/features/subscription/service.go`
- `apps/backend/internal/features/subscription/repository.go`
- `apps/backend/internal/features/subscription/handler.go`
- `apps/backend/internal/features/subscription/service_test.go`
- `apps/backend/internal/features/subscription/model_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/subscription/...
```

### Docs

- `apps/backend/docs/api/subscriptions.md`
- `obsidian/05 Domains/Subscriptions.md`
- `obsidian/03 Backend/Subscriptions Backend.md`
- `obsidian/09 Journeys/Journey Manage cellar box.md`
- `obsidian/01 Maps/Known gaps.md` (`PATCH /subscriptions/:id` accepts `address_id` (PR-005c))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-005c marked DONE 2026-08-16)

## PR-011c — Option catalog must not 500 the product form

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-option-catalog-isolate

`getProductOptionCatalog` still throws (N+1 types + values). The product
editor isolates it via `loadProductOptionCatalog` so a catalog failure
cannot empty brand/category/tag lookups or 500 the editor. Lookups still
throw (PR-001). `optionCatalogError` is passed into `ProductForm` →
`VariantsSection`. Failure keeps the empty-options chrome plus a distinct
Persian error and «تلاش دوباره» (`router.refresh()`). An empty catalog
with no error still says «هنوز ویژگی مشترکی تعریف نشده». Default
`canWrite` is unchanged.

### Files

- `apps/frontend/features/admin/products/api/server.ts`
- `apps/frontend/features/admin/products/api/getProductOptionCatalog.test.ts`
- `apps/frontend/features/admin/products/components/product-editor-view.tsx`
- `apps/frontend/features/admin/products/components/product-editor-view.test.tsx`
- `apps/frontend/features/admin/products/components/ProductForm.tsx`
- `apps/frontend/features/admin/products/components/ProductForm.integration.test.tsx`
- `apps/frontend/features/admin/products/components/product-form/VariantsSection.tsx`
- `apps/frontend/features/admin/products/components/product-form/VariantsSection.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/products --passWithNoTests
```

- Use `./node_modules/.bin/vitest` so aliases + jsdom resolve
- Vitest: 18 files, 75 tests, all passed

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/09 Journeys/Journey Admin publish product.md`
- `obsidian/12 Playbooks/Playbook Add admin module.md`
- `obsidian/01 Maps/Known gaps.md` (PR-011c Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-011c marked DONE 2026-08-16)

## PR-005a — Payment-start URL on wallet top-up + gift purchase (and checkout)

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-payment-start-url

Gateway intents (`CreateWalletTopUp`, `CreateGiftCardPurchase`) and checkout
`payments.Create` now attach `payment_url` =
`{PAYMENT_START_BASE_URL}?transaction_id={id}`. No PSP client. Empty URL
when the base is unset (dev only) is **not** a successful pay. Production
`Config.Validate` requires `PAYMENT_START_BASE_URL`. Wallet/gift JSON
views map the field through. Order response attach stays PR-020f.

### Files

- `apps/backend/internal/features/payments/model.go`
- `apps/backend/internal/features/payments/service.go`
- `apps/backend/internal/features/payments/service_test.go`
- `apps/backend/internal/features/payments/wire.go`
- `apps/backend/internal/features/payments/mapper.go`
- `apps/backend/internal/features/wallet/handler.go`
- `apps/backend/internal/features/wallet/model.go`
- `apps/backend/internal/features/wallet/service_test.go`
- `apps/backend/internal/features/giftcard/handler.go`
- `apps/backend/internal/features/giftcard/model.go`
- `apps/backend/internal/features/giftcard/model_test.go`
- `apps/backend/internal/bootstrap/container.go` (adapters + `NewServiceFromDB` start-base arg)
- `apps/backend/configs/config.go`
- `apps/backend/configs/config_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/payments/... ./internal/features/wallet/... ./internal/features/giftcard/...
```

- `go build ./...`: clean
- `go test ./internal/features/payments/... ./internal/features/wallet/... ./internal/features/giftcard/... ./configs/...`: PASS
  - `TestService_CreateWalletTopUp_PaymentURL_WhenBaseSet`
  - `TestService_CreateWalletTopUp_PaymentURL_EmptyWhenUnset`
  - `TestService_CreateGiftCardPurchase_PaymentURL_WhenBaseSet`
  - `TestService_CreateGiftCardPurchase_PaymentURL_EmptyWhenUnset`
  - `TestService_Create_PaymentURL_WhenBaseSet`
  - `TestBuildPaymentStartURL`
  - `TestTopUpResponseJSON_PaymentURL`
  - `TestPurchaseIntentResponseJSON_PaymentURL`
  - production guard: empty `PAYMENT_START_BASE_URL`

### Docs

- `apps/backend/docs/api/payments.md`
- `apps/backend/docs/api/wallet.md`
- `apps/backend/docs/api/gift-cards.md`
- `apps/backend/docs/architecture/payments-and-webhooks.md`
- `apps/backend/docs/architecture/wallet-topup.md`
- `apps/backend/docs/architecture/gift-card-purchase.md`
- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `apps/backend/docs/getting-started.md`
- `obsidian/05 Domains/Payments.md`
- `obsidian/03 Backend/Payments Backend.md`
- `obsidian/09 Journeys/Journey Account wallet top-up.md`
- `obsidian/09 Journeys/Journey Gift card purchase.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/01 Maps/Known gaps.md` (Gateway intents include payment_url (PR-005a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-005a marked DONE 2026-08-16)

## PR-020k — Sort stock lines by VariantID (IMPROVEMENT 5.5)

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-stock-lines-sort

`GetStockLines` now sorts returned `inventory.StockLine` rows by
`VariantID` ascending (`sortStockLinesByVariantID`) so reserve / release /
deduct lock inventory rows in a stable global order and concurrent
checkouts cannot 40P01. Create-path reservation in `service.go` is
untouched (PR-020a).

### Files

- `apps/backend/internal/features/orders/repository.go`
- `apps/backend/internal/features/orders/stock_lines_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/orders/...
```

- `go build ./...`: clean
- `go test ./internal/features/orders/...`: PASS (includes
  `TestGetStockLines_SortedByVariantID`)

### Docs

- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/05 Domains/Inventory.md`
- `obsidian/12 Playbooks/Playbook Debug Oversell.md`
- `obsidian/01 Maps/Known gaps.md` (Stock lines sorted by VariantID (PR-020k))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020k marked DONE 2026-08-16)

## PR-061a — Tags / coupons / shipping: `requirePermission`, not `role === "admin"`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-admin-perm-gates

`requireTagAdmin` / `requireCouponAdmin` / `requireShippingAdmin` now wrap
`requirePermission` (`tags:manage` / `coupons:manage` / `shipping:manage`).
Staff with the seeded grant can open those boards; admin still passes via
`can()` / live permissions. Function names are unchanged so page imports stay
valid.

### Files

- `apps/frontend/features/admin/tags/admin-only.ts`
- `apps/frontend/features/admin/tags/admin-only.test.ts`
- `apps/frontend/features/admin/coupons/admin-only.ts`
- `apps/frontend/features/admin/coupons/admin-only.test.ts`
- `apps/frontend/features/admin/shipping/admin-only.ts`
- `apps/frontend/features/admin/shipping/admin-only.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/tags features/admin/coupons features/admin/shipping --passWithNoTests
```

- Use `./node_modules/.bin/vitest` so aliases + jsdom resolve
- Vitest: 16 files, 49 tests, all passed

### Docs

- `apps/frontend/docs/platform/rbac.md`
- `obsidian/02 Architecture/RBAC.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/12 Playbooks/Playbook Add admin module.md`
- `obsidian/01 Maps/Known gaps.md` (Tags/coupons/shipping gated by capability not admin role (PR-061a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-061a marked DONE 2026-08-16)

## PR-030a — Confirmation must match order status

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-confirm-status-copy

Confirmation hero no longer always says «سفارش تأیید شد» / «سپاس از خرید شما».
Paid-like statuses keep the celebration. `pending` / `payment_failed` / other
unpaid use «سفارش ثبت شد» plus honest wait/fail copy. Badge stays
`ORDER_STATUS_FA`. Loyalty block was already paid-gated.

### Files

- `apps/frontend/features/orders/components/order-confirmation-view.tsx`
- `apps/frontend/features/orders/components/order-confirmation-view.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/orders --passWithNoTests
```

- Vitest: 2 files, 5 tests, all passed
- Pending markup does not contain «سفارش تأیید شد»

### Docs

- `apps/frontend/docs/features/storefront-commerce.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/05 Domains/Cart and Checkout.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/12 Playbooks/Playbook Confirmation status copy.md`
- `obsidian/01 Maps/Playbooks MOC.md`
- `obsidian/Brain/Connect 12 Playbooks.md`
- `obsidian/01 Maps/Known gaps.md` (Confirmation copy matches order status (PR-030a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-030a marked DONE 2026-08-16)

## PR-020n — Coupon validate loads caller cart when IDs omitted

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-coupon-validate-cart

`POST /coupons/validate` fills omitted `product_ids` / `category_ids` and a
zero `order_subtotal` from the authenticated user's cart so scoped coupons
preview the same basket CreateOrder redeems. Empty cart → `is_valid: false`
(min-order / applicability), not 500. Usage is not mutated. `CartBasketLookup`
is wired in `coupons.New` via `cart.NewRepository(db)` (`WithCart`); 
`bootstrap/container.go` was not edited.

### Files

- `apps/backend/internal/features/coupons/service.go`
- `apps/backend/internal/features/coupons/handler.go`
- `apps/backend/internal/features/coupons/service_test.go`
- `apps/backend/internal/features/coupons/wire.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/coupons/...
```

- `go build ./...`: clean
- `go test ./internal/features/coupons/...`: PASS
  - `TestCouponService_Validate_OmittedIDsUsesCart`
  - `TestCouponService_Validate_OmittedIDsEmptyCartInvalid`
  - `TestCouponService_Validate_ExplicitIDsSkipCart`
  - `TestCouponService_Validate_ZeroSubtotalFilledFromCart`
  - `TestCouponService_Validate_CartErrorIsInternal`

### Docs

- `apps/backend/docs/api/coupons.md`
- `obsidian/05 Domains/Shipping and Coupons.md`
- `obsidian/05 Domains/Cart and Checkout.md`
- `obsidian/03 Backend/Coupons Backend.md`
- `obsidian/03 Backend/Cart Backend.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/12 Playbooks/Playbook Debug Coupon validate.md`
- `obsidian/01 Maps/Playbooks MOC.md`
- `obsidian/Brain/Connect 12 Playbooks.md`
- `obsidian/07 Docs Bridge/Docs Bridge Backend.md`
- `obsidian/01 Maps/Known gaps.md` (Coupon validate loads caller cart when IDs omitted (PR-020n))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020n marked DONE 2026-08-16)

## PR-035b — Subscription address change UI (after PR-005c)

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-sub-address-ui

Active / paused cellar-box cards can set or change ship-to from the
already-loaded address book. `UpdateSubscriptionInput.action` is optional;
PATCH `{ address_id }` does not require pause/resume. Cancelled cards stay
read-only. Missing address keeps the amber «آدرسی به این باکس وصل نیست»
callout plus a picker when the book has rows. API errors use
`apiErrorToast`; success is not toasted on failure. Not PH-043c (no
auto-charge). Not Netflix entitlements.

### Files

- `apps/frontend/features/subscriptions/types.ts`
- `apps/frontend/features/subscriptions/components/subscription-display-helpers.ts`
- `apps/frontend/features/subscriptions/components/subscription-display-helpers.test.ts`
- `apps/frontend/features/subscriptions/components/subscription-card.tsx`
- `apps/frontend/features/subscriptions/components/subscription-card.test.tsx`
- `apps/frontend/features/subscriptions/components/subscriptions-panel.tsx`
- `apps/frontend/features/subscriptions/components/subscriptions-view.tsx`
- `apps/frontend/features/subscriptions/components/subscriptions-view.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/subscriptions --passWithNoTests
```

- Use `./node_modules/.bin/vitest` so aliases + jsdom resolve
- Vitest: 3 files, 12 tests, all passed

### Docs

- `apps/frontend/docs/features/subscriptions.md`
- `apps/frontend/docs/features/account-tour.md`
- `obsidian/09 Journeys/Journey Manage cellar box.md`
- `obsidian/12 Playbooks/Playbook Change cellar box address.md`
- `obsidian/01 Maps/Playbooks MOC.md`
- `obsidian/Brain/Connect 12 Playbooks.md`
- `obsidian/04 Frontend/Account FE.md`
- `obsidian/05 Domains/Subscriptions.md`
- `obsidian/03 Backend/Subscriptions Backend.md`
- `obsidian/01 Maps/Known gaps.md` (Subscription address change UI (PR-035b))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-035b marked DONE 2026-08-16)

## PR-030c — Consume `payment_url` after PR-005a

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-consume-payment-url

Wallet top-up and gift purchase pending UIs now show primary «پرداخت در درگاه»
when the intent includes a non-empty `payment_url` (absolute, same window).
Empty/missing URL keeps the existing pending copy — FE never invents a start
URL. `POST /orders` still has no field (PR-020f); checkout only got a comment.
Confirmation view was not touched (PR-030a). Store BFF was not allow-listed;
the CTA uses the external URL as-is.

### Files

- `apps/frontend/features/wallet/types.ts`
- `apps/frontend/features/wallet/wallet-topup.tsx`
- `apps/frontend/features/wallet/topup.test.ts`
- `apps/frontend/features/wallet/wallet-topup.test.tsx`
- `apps/frontend/features/gift-cards/types.ts`
- `apps/frontend/features/gift-cards/gift-card-purchase.tsx`
- `apps/frontend/features/gift-cards/purchase.test.ts`
- `apps/frontend/features/gift-cards/gift-card-purchase.test.tsx`
- `apps/frontend/features/checkout/components/checkout-flow.tsx` (comment only)
- `apps/frontend/features/checkout/components/checkout-payment-step.tsx` (comment only)

### Verify

From `apps/frontend`:

```
npx vitest run features/wallet features/gift-cards features/checkout --passWithNoTests
```

- Use `./node_modules/.bin/vitest` so aliases + jsdom resolve
- Vitest: 9 files, 35 tests, all passed

### Docs

- `apps/frontend/docs/features/wallet.md`
- `apps/frontend/docs/features/gift-cards.md`
- `apps/frontend/docs/features/storefront-commerce.md`
- `obsidian/09 Journeys/Journey Account wallet top-up.md`
- `obsidian/09 Journeys/Journey Gift card purchase.md`
- `obsidian/04 Frontend/Account FE.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/05 Domains/Payments.md`
- `obsidian/12 Playbooks/Playbook Debug Webhook.md`
- `obsidian/01 Maps/Known gaps.md` (FE consumes payment_url on top-up/gift (PR-030c))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-030c marked DONE 2026-08-16)

## PR-005b — Email gift code after paid fulfill

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-gift-fulfill-email

`giftcard.FulfillPaidPurchaseTx` emails the purchaser the gift **code** +
amount after a successful **new** `InsertPurchasedTx`. Replay
(`GetByPurchaseTxID` hit) returns nil without notify. Dispatcher
(`DispatchGiftPurchased` / `notification.gift_purchased.v1`) is preferred;
`notify.Mailer` is the fallback. Nil mailer/dispatcher or missing email
skips send and still fulfills. Send failure is logged and does not roll
back the card (`GET /gift-cards/mine` remains the fallback). Full code is
never logged at info. Container wiring is **not** in this PR (PR-020a owns
`bootstrap/container.go`); expose `WithMailer` / `WithDispatcher` /
`WithPurchaserEmailLookup`.

### Files

- `apps/backend/internal/features/giftcard/service.go`
- `apps/backend/internal/features/giftcard/wire.go`
- `apps/backend/internal/features/giftcard/service_test.go`
- `apps/backend/internal/features/giftcard/doc.go`
- `apps/backend/internal/notifications/dispatcher.go`
- `apps/backend/internal/notifications/dispatcher_test.go`
- `apps/backend/internal/notifications/event.go`
- `apps/backend/internal/notifications/handler.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/giftcard/...
```

- `go build ./...`: clean
- `go test ./internal/features/giftcard/... ./internal/notifications/...`: PASS
  - `TestFulfillPaidPurchaseNotifiesOnce`
  - `TestFulfillPaidPurchaseDispatcherNotifiesOnce`
  - `TestFulfillPaidPurchaseNilMailerStillSucceeds`
  - `TestFulfillPaidPurchaseSendFailureDoesNotFailFulfill`
  - `TestFulfillPaidPurchaseIdempotent`
  - `TestDispatcherGiftPurchasedAsyncEnqueues`
  - `TestDispatcherGiftPurchasedInlineUsesMail`

### Docs

- `apps/backend/docs/api/gift-cards.md`
- `apps/backend/docs/architecture/gift-card-purchase.md`
- `apps/backend/docs/architecture/notifications-kafka.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/09 Journeys/Journey Gift card purchase.md`
- `obsidian/03 Backend/Gift Card Backend.md`
- `obsidian/03 Backend/Notifications.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/12 Playbooks/Playbook Debug Webhook.md`
- `obsidian/01 Maps/Known gaps.md` (Gift code emailed after paid fulfill (PR-005b))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-005b marked DONE 2026-08-16)

## PR-020a — Wallet checkout must debit + mark paid + deduct in one TX

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-wallet-checkout-debit

`POST /orders` with `payment_method=wallet` now settles inside the create TX:
`WalletPurchaser.PurchaseTx` + `MarkAsPaid` + `DeductForOrderTx` (same reserved
lines). Response status is `paid`. No pending `payment_transactions` row.
Insufficient funds return `INSUFFICIENT_FUNDS` and roll back the order +
reserve. Non-wallet rails still reserve and open a best-effort pending payment
(PR-020f). `wallet.Purchase` is a wrapper around `PurchaseTx`.

### Files

- `apps/backend/internal/features/orders/service.go`
- `apps/backend/internal/features/orders/service_test.go`
- `apps/backend/internal/features/orders/wire.go`
- `apps/backend/internal/features/wallet/service.go` (`PurchaseTx`, `AvailableBalance`)
- `apps/backend/internal/features/wallet/service_test.go`
- `apps/backend/internal/bootstrap/container.go` (orders Deps.Wallet)

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/orders/... ./internal/features/wallet/...
```

- `go build ./...`: clean
- `go test ./internal/features/orders/... ./internal/features/wallet/...`: ok
  - `TestCreateOrder_WalletSettlesInSameTx`
  - `TestCreateOrder_WalletInsufficientFundsRollsBack`
  - `TestCreateOrder_WalletCheapBalanceRejectsBeforeDebit`
  - `TestCreateOrder_NonWalletStillCreatesPendingPayment`
  - `TestService_PurchaseTx_UsesCallerTx`
  - `TestService_PurchaseTx_InsufficientFunds`

### Docs

- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `apps/backend/docs/api/orders.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/03 Backend/Orders Backend.md`
- `obsidian/03 Backend/Wallet Backend.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/12 Playbooks/Playbook Debug Oversell.md`
- `obsidian/01 Maps/Known gaps.md` (Wallet checkout debits + marks paid in one TX (PR-020a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020a marked DONE 2026-08-16)

## Fire 13 — 2026-08-16 (coordinator union)

**Done:** PR-020b, PR-020c, PR-020d, PR-020e, PR-030b, PR-031a, PR-034a, PR-040a, PR-040b, PR-040d, PR-060a, PR-080d

### What landed

- **PR-020b:** `inventory_reservations` binds Reserve/Release/Deduct to `order_id`. Webhook fail flips order `payment_failed` then releases this order only. Late deduct without an active row → `ErrInvalidState` (no foreign committed steal).
- **PR-020c:** Cron `reservation_ttl` every 5m; unpaid pending >30m → `payment_failed` + release + fail dangling payments. Coupon reverse left to PR-020j.
- **PR-020d:** `POST /admin/orders/:id/refund` (wallet credit + restock + clawback + status). PATCH refund-family statuses rejected.
- **PR-020e:** Shipping `IR` matches `IR-*` zones. Checkout collects `state_province`; quotes prefer `IR-TEH`.
- **PR-030b:** Wallet+pending confirmation does not claim a debit.
- **PR-031a:** Optimistic qty/remove, per-line busy, remove undo toast.
- **PR-034a:** Distinct login/OTP error codes; signed-in users bounce off login/register.
- **PR-040a:** Prod requires `TRUSTED_PROXIES`; compose `172.16.0.0/12`; nginx XFF=`$remote_addr`.
- **PR-040b:** Session callback no longer projects the Go JWT; BFF/`apiFetch`/proxy read `getToken`.
- **PR-040d:** Subscription create/update require owned `address_id`.
- **PR-060a:** Dashboard module cards use `requireStaff()` session permissions.
- **PR-080d:** Storefront layout catches `getCategoryTree` failure and renders empty tree.

### Coordinator verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/inventory/... ./internal/features/payments/... ./internal/features/orders/... ./internal/corn/... ./internal/features/shipping/... ./internal/features/subscription/... ./configs/...
```

- `go build ./...`: PASS
- scoped `go test`: PASS (inventory, payments, orders, corn, shipping, subscription, configs)

From `apps/frontend`:

```
npx vitest run features/orders/components/order-confirmation-view features/cart features/auth lib/auth lib/api features/dashboard "app/(storefront)/layout.test.tsx" features/checkout --passWithNoTests
npx tsc --noEmit
```

- Vitest: 27 files, 121 tests, PASS
- `tsc --noEmit`: PASS (fixed `cart-lines.tsx` TS18048 after union)

### Files (highlights)

- `apps/backend/migrations/main/20260816190000_inventory_order_reservations.sql`
- `apps/backend/internal/features/inventory/{repository.go,reservation.go,service.go}`
- `apps/backend/internal/features/orders/{refund.go,expire_reservations.go,payment_failed.go}`
- `apps/backend/internal/corn/reservation_ttl.go`
- `apps/backend/internal/bootstrap/container.go`
- `apps/backend/configs/config.go`
- `docker-compose.prod.yml`, `infra/nginx/nginx.prod.conf`
- `apps/frontend/lib/auth/{auth.config.ts,auth.ts,session.ts,types.ts}`
- `apps/frontend/app/api/{store,admin}/[...path]/route.ts`, `proxy.ts`
- `apps/frontend/features/cart/{api.ts,components/cart-lines.tsx}`
- `apps/frontend/app/(storefront)/layout.tsx`, `app/admin/page.tsx`

## Fire 14 — 2026-08-16 (coordinator union)

**Done:** PR-020f, PR-020m, PR-020q, PR-020s, PR-030d, PR-032a, PR-034b, PR-035a, PR-040g, PR-070a, PR-080c, PR-090a

### Coordinator verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/orders/... ./internal/features/payments/... ./internal/features/inventory/... ./internal/features/catalog/product/... ./internal/features/auth/... ./internal/middlewares/... ./configs/...
```

- `go build ./...`: PASS
- scoped `go test`: PASS

From `apps/frontend`:

```
npx vitest run features/checkout features/auth features/account features/product-alerts app/(storefront)/contact app/(account)/account --passWithNoTests
npx tsc --noEmit
```

- Vitest: 19 files, 81 tests, PASS
- `tsc --noEmit`: PASS

### Highlights

- PR-020f: pending payment in create TX; `POST /orders/:id/pay`; `payment_id`/`transaction_id`/`payment_url` on order response
- PR-020m: GetStockLines from `order_items` only
- PR-020q: `isBusinessError` uses `errors.Is` + wrapped-sentinel test
- PR-020s: paginated low-stock + variant movements
- PR-030d: honest bank-transfer wait copy
- PR-032a: account overview HydrationBoundary prefetch
- PR-034b: reset token validated on load
- PR-035a: `/account/alerts` list/delete
- PR-040g: throttle refresh/logout/validate; dummy bcrypt on login miss
- PR-070a: price filter requires active variants
- PR-080c: settings-backed `/contact`
- PR-090a: prod compose `AUTH_SECRET` + `AUTH_URL`

## Fire 15 — 2026-08-16 (coordinator union)

**Done:** PR-020i, PR-030e, PR-033a, PR-040c, PR-040h, PR-050c, PR-061b, PR-065a, PR-070b, PR-070c, PR-080a, PR-080e

### Coordinator verify

```
cd apps/backend && go build ./...
go test ./internal/features/orders/... ./internal/features/reviews/... ./internal/features/site_settings/... ./internal/features/catalog/product/... ./internal/analytics/... ./internal/features/users/... ./internal/features/wallet/... ./internal/features/rbac/...
```

- `go build ./...`: PASS
- scoped `go test`: PASS (orders after payment-URL fixture + unused-import fix)

```
cd apps/frontend && npx vitest run features/checkout features/account/orders features/orders features/admin/payments features/admin/gift-cards features/admin/settings features/catalog/categories features/storefront lib/api/forward-headers --passWithNoTests
npx tsc --noEmit
```

- Vitest: 29 files, 127 tests, PASS
- `tsc --noEmit`: PASS

## Fire 16 — 2026-08-16 (coordinator union)

**Done:** PR-020l, PR-033b, PR-035c, PR-040e, PR-051a, PR-051b, PR-052a, PR-060b, PR-061c, PR-062a, PR-080b, PR-090b

### What landed

- **PR-020l** — PATCH status is warehouse-only. `paid` / `cancelled` / refund-family rejected (`409 INVALID_STATE`); graph `paid → processing → ready_to_ship|shipped → out_for_delivery|delivered`.
- **PR-033b** — Account order detail: AlertDialog cancel confirm; pay CTA for pending/payment_failed (not wallet); redirect only on non-empty `payment_url`.
- **PR-035c** — Wallet ledger uses `GET /wallet/transactions?page&limit` (`WALLET_LEDGER_PAGE_SIZE=20`). Dir/date are display filters on the server page.
- **PR-040e** — `POST /admin/users/:userID/ban|unban` behind `customers:ban` (not OR'd onto write).
- **PR-051a** — Public `GetAll`/`GetByID` hydrate `review_images` in one batch; missing keys `[]`.
- **PR-051b** — `reviews.md` create path: no `403` for missing purchase; `verified_purchase: false` + `201`.
- **PR-052a** — ForYou overlays taste quiz (categories + flavor/occasions tags) at serve time; lookup miss → behavioural/trending.
- **PR-060b** — Dashboard analytics / orders / inventory widgets gated by `analytics:read` / `orders:read` / `inventory:read`.
- **PR-061c** — Customer create/edit/deactivate hidden without `customers:write`; wallet credit stays `wallet:credit`.
- **PR-062a** — Admin order detail renders buyer + `ship_to`/`address` + method/payment snapshot.
- **PR-080b** — Storefront layout replaces chrome with `MaintenanceScreen` when `maintenance.enabled`.
- **PR-090b** — Store BFF ALLOW includes first-segment `payments`.

### Coordinator verify

```
cd apps/backend && go build ./...
go test ./internal/features/orders/ ./internal/features/users/ ./internal/features/reviews/ ./internal/features/recommendations/
```

- `go build ./...`: PASS
- scoped `go test`: PASS (orders/users/reviews cached; recommendations 0.009s including new `blend_test.go`)

```
cd apps/frontend && npx vitest run features/account/orders features/account/wallet features/admin/orders features/admin/customers app/admin/page.test.tsx features/storefront/maintenance app/api/store --passWithNoTests
npx tsc --noEmit
```

- Vitest: 17 files, 60 tests, PASS (plus re-run OrderDetail + customer detail page after tsc fix: 9 tests PASS)
- `tsc --noEmit`: PASS (after `order` null guards + `can` mock typing)

### Dual-doc

- Project: `apps/backend/docs/api/orders.md`, `users.md`, `reviews.md`, `recommendations.md`, `architecture/rbac.md`; `apps/frontend/docs/features/storefront.md`, `docs/platform/bff-and-auth.md`
- Obsidian: Orders Backend, Users Backend, Recommendations Backend, Customers Admin, Account FE, BFF Proxies, Surface Storefront

## PR-054a — Referral claim `claimed` or 400

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-referral-claim

`POST /referrals/claim` no longer returns 204 for every body. A new pending
row is `200 {claimed: true}`. Unknown, blank, self, already-claimed, and
insert-race (`ON CONFLICT DO NOTHING` 0 rows) are `400 INVALID_REQUEST`.
The handler never emits `claimed: false`. Lookup DB errors stay 500.

### Files

- `apps/backend/internal/features/referral/handler.go`
- `apps/backend/internal/features/referral/service.go`
- `apps/backend/internal/features/referral/repository.go`
- `apps/backend/internal/features/referral/model.go`
- `apps/backend/internal/features/referral/model_test.go`
- `apps/backend/internal/features/referral/service_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/referral/
```

- `go build ./...`: clean
- `go test ./internal/features/referral/`: ok

### Docs

- `apps/backend/docs/api/referrals.md` (new)
- `apps/backend/docs/api/README.md`
- `apps/backend/docs/architecture/loyalty.md`
- `apps/frontend/docs/features/account-tour.md`
- `obsidian/05 Domains/Referrals.md`
- `obsidian/03 Backend/Referral Backend.md`
- `obsidian/03 Backend/Referrals Backend.md`
- `obsidian/09 Journeys/Journey Referral complete on paid order.md`
- `obsidian/07 Docs Bridge/Docs Bridge Backend.md`
- `obsidian/01 Maps/Known gaps.md` (Referral claim `{claimed:true}` or 400 (PR-054a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-054a marked DONE 2026-08-16)

## PR-020g — Checkout currency `IRT` not `USD`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-currency-irt · **Fire:** 17

`orders.defaultCurrency` is now `"IRT"` (was `"USD"`). New checkout
`payment_transactions` (create + `POST /orders/:id/pay`) take that
constant — same code as wallet/gift intents and the
`payment_transactions.currency` table default. Multi-currency remains
deferred.

### Files

- `apps/backend/internal/features/orders/service.go` (`defaultCurrency` + `createPendingIntent`)
- `apps/backend/internal/features/orders/service_test.go` (already asserted `IRT`; unchanged)

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/orders/
```

- `go build ./...`: PASS
- `go test ./internal/features/orders/`: PASS (`ok`, then `-count=1` re-run `ok 0.004s`)

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/backend && go build ./... && go test ./internal/features/orders/
```

**Result:** PASS

### Docs

- `apps/backend/docs/api/orders.md` (settlement currency IRT)
- `apps/backend/docs/architecture/money-and-stock-sagas.md` (invariant 8)
- `obsidian/03 Backend/Orders Backend.md` (currency note)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020g marked DONE 2026-08-16)

## PR-051c — Review unlike

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-review-unlike · **Fire:** 17

`DELETE /reviews/:id/react` removes the caller's like/dislike and
decrements the matching counter. No existing vote is still `204`
(idempotent), matching repeated identical `POST /reviews/:id/react`.
Missing or unapproved review stays `404`. Handler/service shape matches
`React`.

### Files

- `apps/backend/internal/features/reviews/routes.go`
- `apps/backend/internal/features/reviews/handler.go`
- `apps/backend/internal/features/reviews/service.go`
- `apps/backend/internal/features/reviews/repository.go`
- `apps/backend/internal/features/reviews/service_test.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/reviews/
```

- `go build ./...`: PASS
- `go test ./internal/features/reviews/`: PASS (`ok 0.003s`)

### Docs

- `apps/backend/docs/api/reviews.md` (`DELETE /reviews/:id/react`)
- `obsidian/03 Backend/Reviews Backend.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-051c marked DONE 2026-08-16)

## PR-058b — Hydrate wishlist `options`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-wishlist-options · **Fire:** 17

`GetItems` now loads variant options for every wishlist line in one extra
query (`product_variants_options` → `option_values` → `option_types`,
`ANY($1)`). `ItemResponse.Options` uses the existing
`models.OptionValueResponse` shape. Variants with no options stay
empty/omitted. Active-product/variant filters on the line query are
unchanged.

### Files

- `apps/backend/internal/features/wishlist/repository.go`
- `apps/backend/internal/features/wishlist/repository_items_test.go`
- `apps/backend/internal/features/wishlist/model.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/wishlist/
```

- `go build ./...`: PASS
- `go test ./internal/features/wishlist/`: PASS (`ok 0.003s`)

### Docs

- `apps/backend/docs/architecture/domain-map.md`
- `apps/backend/docs/api/wishlist.md`
- `obsidian/03 Backend/Wishlist Backend.md`
- `obsidian/05 Domains/Wishlist and Reviews.md`
- `obsidian/01 Maps/Known gaps.md` (PR-058b Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-058b marked DONE 2026-08-16)

## PR-035d — Delete empty account/checkout stub modules

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-delete-stubs · **Fire:** 17

Removed empty unused feature-split shells under `features/account/**` and
`features/checkout/**`. Nothing imported them. Live checkout-flow,
confirmation, wallet, orders, and cart were not edited. Domain APIs stay
in `features/<domain>/` (addresses, cart, orders, shipping, wishlist,
reviews, profile).

### Files deleted

- `apps/frontend/features/checkout/{api,types,validations}.ts`
- `apps/frontend/features/account/account/{api,types,validations}.ts`
- `apps/frontend/features/account/reviews/{api,types,validations}.ts`
- `apps/frontend/features/account/settings/{api,types}.ts`
- `apps/frontend/features/account/wishlist/{api,types,validations}.ts`
- `apps/frontend/features/account/addresses/api.ts`

No stub tests existed.

### Verify

From `apps/frontend`:

```
npx vitest run features/account features/checkout --passWithNoTests
npx tsc --noEmit
```

- Vitest: 10 files, 62 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/storefront-commerce.md`
- `apps/frontend/docs/features/account-tour.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/04 Frontend/Account FE.md`
- `obsidian/05 Domains/Cart and Checkout.md`
- `obsidian/01 Maps/Known gaps.md` (PR-035d Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-035d marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-commerce-account.md` (PR-035d closed)

## PR-053b — Enrich GET /alerts with title/slug/price

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-alert-enrich · **Fire:** 17

`GET /alerts` now JOINs `products` + `product_variants` and returns
`product_title`, `product_slug`, and the subscribed variant's live
`current_price`. The account list does not need a second product hop.
POST create is unchanged (those three keys are JSON `null`). Repository
interface is unchanged so the cron fake still compiles.

### Files

- `apps/backend/internal/features/alerts/{model,repository,service}.go`
- `apps/backend/internal/features/alerts/{model_test,service_test}.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/alerts/
```

- `go build ./...`: PASS
- `go test ./internal/features/alerts/`: PASS (`TestProductAlertResponseIncludesNullableFields`, `TestProductAlertResponseIncludesListEnrichment`, `TestListCopiesProductEnrichment`). There is no `product_alerts` package.

### Docs

- `apps/backend/docs/api/alerts.md` (new)
- `apps/backend/docs/api/README.md` (resource + customer route map)
- `obsidian/05 Domains/Product Alerts.md`
- `obsidian/03 Backend/Product Alerts Backend.md`
- `obsidian/07 Docs Bridge/Docs Bridge Backend.md`
- `obsidian/01 Maps/Known gaps.md` (GET `/alerts` hydrates title/slug/variant price (PR-053b))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-053b marked DONE 2026-08-16)

## PR-056a — Admin gift-card list + void

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-giftcard-admin

Staff can page issued cards and void unused ones. Capability stays
`gift-cards:issue` (already mounted on `RegisterAdmin`). No FE list
(that is PR-064a). Void is not a refund.

- `GET /admin/gift-cards` → `{results, pagination}` (`page`/`limit`/`status`/`search`)
- `POST /admin/gift-cards/:id/void` → active → `disabled`; missing `404`; redeemed/disabled `409 INVALID_STATE`

### Files

- `apps/backend/internal/features/giftcard/{handler,service,repository,model,routes,doc,service_test,model_test}.go`
- `apps/backend/docs/api/gift-cards.md`
- `apps/backend/docs/architecture/gift-card-purchase.md` (void no longer a non-goal)
- `obsidian/03 Backend/Gift Card Backend.md`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/giftcard/
```

- `go build ./...`: PASS
- `go test ./internal/features/giftcard/`: PASS (`ok github.com/tiredbooy/internal/features/giftcard 0.004s`)

## PR-057a — Do not advance box renewal if email failed / mailer nil

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-box-renewal-mail

`ProcessDueRenewals` no longer rolls `next_renewal_at` when `mailer == nil` or
when `Send` fails. Nil mailer logs and returns without advancing so the next
tick can retry. A send error skips that id only; successes in the same batch
still roll. The job does not invent emails or charge a card (PH-043c).

### Files

- `apps/backend/internal/features/subscription/renewal.go`
- `apps/backend/internal/features/subscription/renewal_test.go`
- `apps/backend/internal/features/subscription/service_test.go`
- `apps/backend/internal/features/subscription/doc.go`
- `apps/backend/internal/corn/subscription_renewal_job.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/subscription/
```

- `go build ./...`: clean
- `go test ./internal/features/subscription/`: PASS — `TestProcessDueRenewals_AdvanceOnlyAfterSend` (mailer nil never advances; send error does not advance that id; send ok advances that id; mixed batch advances only successes)

### Docs

- `apps/backend/docs/architecture/box-subscriptions.md`
- `apps/backend/docs/architecture/processes-and-jobs.md`
- `apps/backend/docs/architecture/box-auto-charge-decision.md`
- `apps/backend/docs/api/subscriptions.md`
- `apps/backend/BACKEND-IMPROVEMENTS.md`
- `obsidian/05 Domains/Subscriptions.md`
- `obsidian/09 Journeys/Journey Subscription renewal email.md`
- `obsidian/03 Backend/Subscriptions Backend.md`
- `obsidian/03 Backend/Processes and Jobs.md`
- `obsidian/11 Decisions/ADR Box auto-charge declined.md`
- `obsidian/12 Playbooks/Playbook Debug Subscription renewal email.md`
- `obsidian/01 Maps/Playbooks MOC.md`
- `obsidian/01 Maps/Known gaps.md` (Renewal cron advances only after email send (PR-057a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-057a marked DONE 2026-08-16)

## PR-062b — Fulfillment vs refund UI after PR-020d/l

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-fulfill-refund-ui

Admin `OrderActions` no longer treats refund as a status PATCH. The
warehouse select only lists PR-020l hops (`paid → processing →
ready_to_ship|shipped → out_for_delivery|delivered`). Current status is
shown disabled; `paid` / `cancelled` / refund-family are never selectable
targets. Refund is a confirm button that `POST`s `/admin/orders/:id/refund`
via `refundAdminOrderClient`. Success/error toasts follow the real
response — no fake success.

### Files

- `apps/frontend/features/admin/orders/components/OrderActions.tsx`
- `apps/frontend/features/admin/orders/components/OrderActions.test.tsx`
- `apps/frontend/features/admin/orders/hooks.ts`
- `apps/frontend/features/orders/api/admin-client.ts`
- `apps/frontend/features/orders/api/admin-client.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/orders --passWithNoTests
npx tsc --noEmit
```

- Vitest: 3 files, 15 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `apps/frontend/docs/features/storefront-commerce.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/01 Maps/Known gaps.md` (Admin fulfillment vs refund UI (PR-062b))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-062b marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-062b marked DONE 2026-08-16)

## Fire 17 — 2026-08-16 (coordinator union)

**Done:** PR-020g, PR-035d, PR-040i, PR-050d, PR-051c, PR-053b, PR-054a, PR-056a, PR-057a, PR-058b, PR-061d, PR-062b

### Coordinator verify

```
cd apps/backend && go build ./...
go test ./internal/features/orders/ ./internal/features/users/ ./internal/features/auth/ ./internal/features/payments/ ./internal/features/reviews/ ./internal/features/alerts/ ./internal/features/referral/ ./internal/features/giftcard/ ./internal/features/subscription/ ./internal/features/wishlist/ ./internal/features/recommendations/ ./internal/features/cart/ ./internal/corn/
```

- `go build ./...`: PASS
- scoped `go test`: PASS (orders, users, auth, payments, reviews, alerts, referral, giftcard, subscription, wishlist, recommendations, cart, corn)

```
cd apps/frontend && npx vitest run features/admin/orders features/admin/categories features/admin/recipes features/account features/checkout app/admin/categories app/admin/recipes --passWithNoTests
npx tsc --noEmit
```

- Vitest: 14 files, 79 tests, PASS
- `tsc --noEmit`: PASS

## PR-050d — Server-side purchase on Confirm + add_to_cart

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-purchase-on-confirm · **Fire:** 17

BE owns paid `purchase` and cart `add_to_cart` recommendation signals.
`payments.Confirm` (order checkout only, after money/stock commit) calls
`RecordPurchasesForOrder` — one `purchase` per distinct order-line
`product_id` (`source=payments.confirm`, `metadata.order_id`). Wallet
top-up and gift-card Confirm do not write. Recs failure is logged and
does not undo payment. `cart.AddItem` / `AddItems` record `add_to_cart`
after a successful line write; recs failure does not fail the cart.
Unknown `product_id` on `RecordInteraction` is 404. Same-day
`purchase`/`add_to_cart` (and purchase with the same `order_id`) do not
double-weight. Order-line lookup errors are returned, not swallowed as
empty success.

### Files

- `apps/backend/internal/features/payments/service.go`
- `apps/backend/internal/features/payments/wire.go`
- `apps/backend/internal/features/payments/doc.go`
- `apps/backend/internal/features/payments/service_earn_test.go`
- `apps/backend/internal/features/recommendations/service.go`
- `apps/backend/internal/features/recommendations/repository.go`
- `apps/backend/internal/features/recommendations/doc.go`
- `apps/backend/internal/features/recommendations/service_test.go`
- `apps/backend/internal/features/cart/service.go`
- `apps/backend/internal/features/cart/wire.go`
- `apps/backend/internal/features/cart/doc.go`
- `apps/backend/internal/features/cart/service_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/payments/ ./internal/features/recommendations/ ./internal/features/cart/
```

- `go build ./...`: PASS
- `go test`: PASS (`payments`, `recommendations`, `cart`)

### Docs

- `apps/backend/docs/api/recommendations.md`
- `apps/backend/docs/api/cart.md`
- `apps/backend/docs/architecture/payments-and-webhooks.md`
- `obsidian/05 Domains/Recommendations.md`
- `obsidian/05 Domains/Payments.md`
- `obsidian/05 Domains/Cart and Checkout.md`
- `obsidian/03 Backend/Recommendations Backend.md`
- `obsidian/03 Backend/Payments Backend.md`
- `obsidian/03 Backend/Cart Backend.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/01 Maps/Known gaps.md` (PR-050d Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-050d marked DONE 2026-08-16)

## PR-061d — Category + recipe editors honor write

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-cat-recipe-write

`/admin/categories/[id]` stays on `requirePermission(PRODUCTS_READ)` and
`/admin/recipes/[id]` stays on `RECIPES_READ` so read-only staff can open
the editors. Each page computes `canWrite` (`PRODUCTS_WRITE` /
`RECIPES_WRITE`) and passes it through `CategoryEditView` /
`RecipeEditView` → the form. Create still requires write at the page and
always passes `canWrite`. When `canWrite` is false the form is view-only:
submit (and recipe delete) hidden, image upload disabled, create/update
clients are not called, Persian “فقط مشاهده” hint shown. Pages are not
403’d for readers. List create / delete were already write-gated.

### Files

- `apps/frontend/app/admin/categories/[id]/page.tsx`
- `apps/frontend/app/admin/recipes/[id]/page.tsx`
- `apps/frontend/features/admin/categories/components/category-editor-view.tsx`
- `apps/frontend/features/admin/categories/components/CategoryForm.tsx`
- `apps/frontend/features/admin/categories/components/category-image-input.tsx`
- `apps/frontend/features/admin/recipes/components/recipe-editor-view.tsx`
- `apps/frontend/features/admin/recipes/components/RecipeForm.tsx`
- `apps/frontend/features/admin/recipes/components/recipe-form/RecipeSidebar.tsx`
- `apps/frontend/features/admin/recipes/components/recipe-form/ContentSection.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/categories features/admin/recipes app/admin/categories app/admin/recipes --passWithNoTests
npx tsc --noEmit
```

- 7 files, 14 tests, all passed (including `canWrite={false}` does not submit)
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/platform/rbac.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/01 Maps/Known gaps.md` (PR-061d Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-061d marked DONE 2026-08-16)

## PR-040i — Phone change requires OTP to the new number

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-phone-otp

Self-service `PATCH /auth/me` no longer persists a new phone. Other profile
fields still save; a new number returns **202** with `pending_phone`. Bind
happens only after OTP to that **new** number (`POST /auth/me/phone/otp` then
`POST /auth/me/phone/verify`), using the existing auth OTP stack (generate,
Redis TTL, per-phone 5/hour send cap, 5 verify tries, `DispatchOTP` purpose
`phone_change`). Codes are user-scoped so they cannot be consumed as login OTP.
Admin `PATCH /admin/users/:userID` may still set phone without OTP.

### Files

- `apps/backend/internal/features/users/phone.go`
- `apps/backend/internal/features/users/phone_test.go`
- `apps/backend/internal/features/users/service.go`
- `apps/backend/internal/features/users/service_test.go`
- `apps/backend/internal/features/users/handler.go`
- `apps/backend/internal/features/users/handler_test.go`
- `apps/backend/internal/features/users/model.go`
- `apps/backend/internal/features/users/routes.go`
- `apps/backend/internal/features/users/doc.go`
- `apps/backend/internal/features/auth/otp.go`
- `apps/backend/internal/features/auth/phone_otp_test.go`
- `apps/backend/internal/features/auth/routes.go`
- `apps/backend/internal/features/auth/doc.go`
- `apps/backend/internal/features/auth/cache_stub_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/users/ ./internal/features/auth/
```

- `go build ./...`: clean
- `go test ./internal/features/users/ ./internal/features/auth/`: ok

### Docs

- `apps/backend/docs/api/auth.md`
- `apps/backend/docs/api/users.md`
- `obsidian/03 Backend/Users Backend.md`
- `obsidian/02 Architecture/Auth and Sessions.md`
- `obsidian/01 Maps/Known gaps.md` (PR-040i Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-040i marked DONE 2026-08-16)

## PR-062d — Render gift / notes / schedule already on the DTO

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-order-gift-notes

Admin order detail prints fulfillment extras already returned by PR-020i GET:
`is_gift`, `gift_message`, `gift_addons`, `notes`, and
`scheduled_delivery_date`. The «هدیه و یادداشت» card appears only when at
least one of those is present — no invented «ثبت نشده» rows. Notes and
schedule can render without a gift flag. `OrderActions` and the orders
table were not touched.

### Files

- `apps/frontend/features/admin/orders/components/order-detail-view.tsx`
- `apps/frontend/features/admin/orders/components/order-detail-view.test.tsx`
- `apps/frontend/features/admin/orders/types.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/orders/components/order-detail-view.test.tsx --passWithNoTests
npx tsc --noEmit
```

- Vitest: 1 file, 8 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/09 Journeys/Journey Buy as gift.md`
- `obsidian/01 Maps/Known gaps.md` (Admin order detail gift / notes / schedule (PR-062d))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-062d marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-062d marked DONE 2026-08-16)

## PR-058a — 404 unknown interaction product_id

**Lane:** be · **Agent:** impl-recs-404 · **Fire:** 18

`POST /recommendations/interactions` checks `ProductExists` before insert.
Unknown `product_id` is `apperr.ErrNotFound`; the handler maps it via
`httpx.HandleError` to **404 NOT_FOUND** (no FK 500). Lookup errors stay
500, not 404. Repo insert still has `WHERE EXISTS (products)` as a belt.

Handler test locks the HTTP mapping. Service tests already covered the
service sentinel. TASKS left `[ ]` because workspace `go build ./...` is
red on concurrent PR-020j mocks (`CancelTx` / `DeleteByOrderTx`), not this
package.

### Files

- `apps/backend/internal/features/recommendations/handler.go`
- `apps/backend/internal/features/recommendations/handler_test.go`
- `apps/backend/internal/features/recommendations/service.go` (ProductExists → ErrNotFound)
- `apps/backend/internal/features/recommendations/repository.go` (`ProductExists`)
- `apps/backend/internal/features/recommendations/service_test.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/recommendations/
```

- `go test ./internal/features/recommendations/`: PASS (`ok 0.004s`)
- `go build ./...`: FAIL — `internal/mocks` missing `orders.Repository.CancelTx` and `coupons.UsageRepository.DeleteByOrderTx` (PR-020j in flight; exclusive to impl-cancel-tx)

### Docs

- `apps/backend/docs/api/recommendations.md`
- `obsidian/03 Backend/Recommendations Backend.md`
- `obsidian/01 Maps/Known gaps.md` (PR-058a Recently filled)
- `refactor-workstreams/production-readiness/findings-be-engagement.md` (contract sheet 404)
- `refactor-workstreams/production-readiness/TASKS.md` (left `[ ]` until workspace build is green)

## PR-064b — Ban UI after PR-040e

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-ban-ui · **Fire:** 18

Customer detail ban/unban is a confirm `POST` to the existing
`/admin/users/:id/ban` and `/unban` endpoints. Buttons show only with
`customers:ban` (not `customers:write`). Hidden with no cap. Self-ban /
self-unban stay hidden. Write-only operators still cannot lift a ban.

### Files

- `apps/frontend/features/customers/client.ts`
- `apps/frontend/features/customers/client.test.ts`
- `apps/frontend/features/admin/customers/components/UserAccountActions.tsx`
- `apps/frontend/features/admin/customers/components/UserAccountActions.test.tsx`
- `apps/frontend/features/admin/customers/components/customer-detail-view.tsx`
- `apps/frontend/features/admin/customers/components/customer-detail-view.test.tsx`
- `apps/frontend/app/admin/customers/[id]/page.tsx`
- `apps/frontend/app/admin/customers/[id]/page.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/customers --passWithNoTests
npx tsc --noEmit
```

- Vitest: 8 files, 29 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `apps/frontend/docs/platform/rbac.md`
- `obsidian/05 Domains/Customers Admin.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/02 Architecture/RBAC.md`
- `obsidian/01 Maps/Known gaps.md` (PR-064b Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-064b marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-064b marked DONE 2026-08-16)

## PR-063c — Dashboard low-stock titles

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-dash-lowstock · **Fire:** 18

Admin-home `LowStockList` prints live `product_title` from
`GET /admin/inventory/low-stock`. Empty title falls back to `sku`, then
`#` + Persian variant id. No invented names. Paginated `{results}` is
unwrapped; a raw array still works.

### Files

- `apps/frontend/features/admin/analytics/components/LowStockList.tsx`
- `apps/frontend/features/admin/analytics/components/LowStockList.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/analytics --passWithNoTests
npx tsc --noEmit
```

- Vitest: 8 files, 20 tests, PASS (including 6 LowStockList title/fallback tests)
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `apps/frontend/docs/features/inventory.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/04 Frontend/Admin Analytics.md`
- `obsidian/04 Frontend/Inventory FE.md`
- `obsidian/01 Maps/Known gaps.md` (Dashboard low-stock widget shows product titles (PR-063c))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-063c marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-063c marked DONE 2026-08-16)

## PR-061e — Journal detail + options list readable without write

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-journal-options-read

`/admin/journal/[id]` is now `requirePermission(JOURNAL_READ)` so
read-only staff can open a post. The page computes
`canWrite = can(session, JOURNAL_WRITE)` and passes it through
`JournalEditView` → `JournalForm`. `/admin/options` is `PRODUCTS_READ`
and `/admin/options/[id]` stays on `PRODUCTS_READ` with
`canWrite = can(session, PRODUCTS_WRITE)` into `OptionsBoard` /
`OptionTypeForm`. Create still requires write at the page and always
passes `canWrite`. When `canWrite` is false the journal form is
view-only: submit hidden, image upload disabled, create/update clients
are not called, Persian “فقط مشاهده” hint shown. The options list hides
create / edit / delete; option values cannot be added or removed.
Pages are not 403’d for readers.

### Files

- `apps/frontend/app/admin/journal/[id]/page.tsx`
- `apps/frontend/features/admin/journal/components/journal-editor-view.tsx`
- `apps/frontend/features/admin/journal/components/journal-form.tsx`
- `apps/frontend/features/admin/journal/components/journal-form.test.tsx`
- `apps/frontend/features/admin/journal/components/journal-editor-view.test.tsx`
- `apps/frontend/app/admin/options/page.tsx`
- `apps/frontend/app/admin/options/[id]/page.tsx`
- `apps/frontend/app/admin/options/new/page.tsx`
- `apps/frontend/features/admin/options/components/options-board.tsx`
- `apps/frontend/features/admin/options/components/option-type-form.tsx`
- `apps/frontend/features/admin/options/components/options-board.test.tsx`
- `apps/frontend/features/admin/options/components/option-type-form.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/journal features/admin/options app/admin/journal app/admin/options --passWithNoTests
npx tsc --noEmit
```

- 6 files, 18 tests, all passed (including `canWrite={false}` does not submit)
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/platform/rbac.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/02 Architecture/RBAC.md`
- `obsidian/01 Maps/Known gaps.md` (PR-061e Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-061e marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-061e marked DONE 2026-08-16)

## PR-062c — Server-side order filters

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-order-filters

Admin `/admin/orders` no longer facets the current page of 50. The route
reads `status`, `paid_from`, `paid_to` (calendar days), `user_id`, and
`page`, and `useAdminOrders` sends them on `GET /admin/orders`. Paid
dates expand to RFC3339 local day bounds (no fractional seconds — Go
BindQuery). DataTable client status/search filters are gone. Empty
catalogue vs filtered miss are distinct copy. `OrderActions` and
order-detail-view were not touched.

### Files

- `apps/frontend/app/admin/orders/page.tsx`
- `apps/frontend/features/admin/orders/order-list-params.ts`
- `apps/frontend/features/admin/orders/order-list-params.test.ts`
- `apps/frontend/features/admin/orders/components/order-list-filters.tsx`
- `apps/frontend/features/admin/orders/components/OrdersTable.tsx`
- `apps/frontend/features/admin/orders/components/OrdersTable.test.tsx`
- `apps/frontend/features/orders/api/admin-client.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/orders --passWithNoTests
npx tsc --noEmit
```

- Vitest: 4 files, 30 tests, PASS (`features/admin/orders`; plus `admin-client` list query test)
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/01 Maps/Known gaps.md` (Admin order list server-side status/date/user filters (PR-062c))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-062c marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-062c marked DONE 2026-08-16)

## PR-063a — Inventory server pagination + `search` / `low_stock`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-inv-pages · **Fire:** 18

`/admin/inventory` no longer calls `listAllInventory()` (every page of
`limit=100`). The list board reads URL `q` / `search`, `page`, and
`low_stock`, and sends one `listInventory()` page (`limit` 20) plus cheap
`limit=1` totals for SKU and low-stock KPI cards. Out-of-stock / missing
weight / stock-value tiles are labeled as the current page. GET filters
search the catalog; DataTable facets stay page-local. Out-of-range `page`
redirects. `listAllInventory` in `features/inventory/api.ts` is unused by
this board (file not in this exclusive set).

### Files

- `apps/frontend/app/admin/inventory/page.tsx`
- `apps/frontend/app/admin/inventory/page.test.ts`
- `apps/frontend/features/admin/inventory/inventory-list-params.ts`
- `apps/frontend/features/admin/inventory/inventory-list-params.test.ts`
- `apps/frontend/features/admin/inventory/components/inventory-list-view.tsx`
- `apps/frontend/features/admin/inventory/components/inventory-list-view.test.ts`
- `apps/frontend/features/admin/inventory/components/InventoryTable.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/inventory app/admin/inventory --passWithNoTests
npx tsc --noEmit
```

- Vitest: 9 files, 34 tests, all passed
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/inventory.md`
- `obsidian/04 Frontend/Inventory FE.md`
- `obsidian/05 Domains/Inventory.md`
- `obsidian/09 Journeys/Journey Admin restock.md`
- `obsidian/01 Maps/Known gaps.md` (PR-063a Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-063a marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-063a marked DONE 2026-08-16)

## PR-064a — Gift-card operator list (after PR-056a)

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-gc-admin-fe · **Fire:** 18

`/admin/gift-cards` is no longer issue-only. Staff with `gift-cards:issue`
get a paginated ledger under «دفتر کارت‌ها» plus the existing issuer.
`GET /admin/gift-cards` (`{results, pagination}`, `page`/`limit`/`status`/
`search`/`sortBy`+`orderBy`) is URL-driven (`page`, `status`, `q`, `sort`).
A failed fetch is a retryable error, not an empty ledger. Void is a confirm
`POST /admin/gift-cards/:id/void` on **active** rows only — not a refund,
no wallet move. Toasts follow the real response (`409 INVALID_STATE` /
`404` shown as-is). Numeric `purchaser_user_id` is not turned into a
customer UUID path.

### Files

- `apps/frontend/app/admin/gift-cards/page.tsx`
- `apps/frontend/features/admin/gift-cards/components/gift-cards-board.tsx`
- `apps/frontend/features/admin/gift-cards/components/gift-cards-board.test.tsx`
- `apps/frontend/features/admin/gift-cards/components/gift-card-list.tsx`
- `apps/frontend/features/admin/gift-cards/components/gift-card-list.test.tsx`
- `apps/frontend/features/admin/gift-cards/components/gift-card-status-badge.tsx`
- `apps/frontend/features/admin/gift-cards/components/gift-card-issuer.tsx`
- `apps/frontend/features/gift-cards/types.ts`
- `apps/frontend/features/gift-cards/hooks.ts`
- `apps/frontend/features/gift-cards/api/admin-client.ts`
- `apps/frontend/features/gift-cards/api/admin-client.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/gift-cards features/gift-cards app/admin/gift-cards --passWithNoTests
npx tsc --noEmit
```

- Vitest: 9 files, 31 tests, all passed
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/gift-cards.md`
- `apps/frontend/docs/features/admin-console.md`
- `apps/frontend/docs/features/account-tour.md`
- `apps/frontend/docs/features/domain-map.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/05 Domains/Loyalty Wallet Gift Cards.md`
- `obsidian/03 Backend/Gift Card Backend.md`
- `obsidian/01 Maps/Known gaps.md` (Admin gift-card list + void confirm (PR-064a))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-064a marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-064a marked DONE 2026-08-16)

## Fire 18 — 2026-08-16 (coordinator union)

**Done:** PR-020j, PR-055a, PR-058a, PR-060c, PR-061e, PR-062c, PR-062d, PR-063a, PR-063c, PR-063d, PR-064a, PR-064b

### Coordinator verify

```
cd apps/backend && go build ./...
go test ./internal/features/orders/ ./internal/features/coupons/ ./internal/features/inventory/ ./internal/features/recommendations/ ./internal/features/alerts/ ./internal/features/subscription/ ./internal/notifications/ ./internal/corn/ ./internal/features/reviews/
```

- `go build ./...`: PASS
- scoped `go test`: PASS (orders/coupons after stub pointer-receiver fix; others cached)

```
cd apps/frontend && npx vitest run features/dashboard features/admin/orders features/admin/journal features/admin/options features/admin/inventory features/admin/analytics features/admin/reviews features/admin/gift-cards features/gift-cards features/admin/customers app/admin --passWithNoTests
npx tsc --noEmit
```

- Vitest: 56 files, 202 tests, PASS
- `tsc --noEmit`: PASS

## PR-055a — Alert + renewal mail through dispatcher

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-dispatcher-mail · **Fire:** 18

Alert restock/price-drop and cellar-box renewal emails go through
`notifications.Dispatcher` when wired (outbox if `NOTIFICATIONS_MODE=async`,
inline mail otherwise). Inline `pkg/notify` is the fallback. Fail closed:
`MarkNotified` / `AdvanceRenewal` run only after dispatch or send succeeds
(PR-053a / PR-057a honesty kept). No box auto-charge.

New event types: `notification.alert.v1` (`alert:{id}:notify`) and
`notification.subscription_renewal.v1` (`subscription:{id}:renewal:{YYYY-MM-DD}`).

### Files

- `apps/backend/internal/notifications/event.go`
- `apps/backend/internal/notifications/dispatcher.go`
- `apps/backend/internal/notifications/dispatcher_test.go`
- `apps/backend/internal/notifications/handler.go`
- `apps/backend/internal/notifications/notifications_test.go`
- `apps/backend/internal/features/alerts/notify.go`
- `apps/backend/internal/features/alerts/notify_test.go`
- `apps/backend/internal/features/alerts/doc.go`
- `apps/backend/internal/features/subscription/renewal.go`
- `apps/backend/internal/features/subscription/renewal_test.go`
- `apps/backend/internal/features/subscription/doc.go`
- `apps/backend/internal/corn/alert_check_job.go`
- `apps/backend/internal/corn/alert_check_job_test.go`
- `apps/backend/internal/corn/subscription_renewal_job.go`
- `apps/backend/internal/corn/subscription_renewal_job_test.go`
- `apps/backend/internal/bootstrap/container.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/alerts/ ./internal/features/subscription/ ./internal/notifications/ ./internal/corn/
```

- `go build ./...`: clean
- `go test ./internal/features/alerts/ ./internal/features/subscription/ ./internal/notifications/ ./internal/corn/`: PASS (cached)

### Docs

- `apps/backend/docs/architecture/notifications-kafka.md`
- `apps/backend/docs/architecture/processes-and-jobs.md`
- `apps/backend/docs/architecture/box-subscriptions.md`
- `apps/backend/docs/architecture/box-auto-charge-decision.md`
- `apps/backend/docs/architecture/domain-map.md`
- `apps/backend/docs/api/alerts.md`
- `apps/backend/docs/api/subscriptions.md`
- `obsidian/05 Domains/Product Alerts.md`
- `obsidian/05 Domains/Subscriptions.md`
- `obsidian/03 Backend/Product Alerts Backend.md`
- `obsidian/03 Backend/Subscriptions Backend.md`
- `obsidian/03 Backend/Notifications.md`
- `obsidian/03 Backend/Processes and Jobs.md`
- `obsidian/09 Journeys/Journey Product alert notify.md`
- `obsidian/09 Journeys/Journey Subscription renewal email.md`
- `obsidian/09 Journeys/Journey Notification async.md`
- `obsidian/12 Playbooks/Playbook Debug Product alert notify.md`
- `obsidian/12 Playbooks/Playbook Debug Subscription renewal email.md`
- `obsidian/11 Decisions/ADR Outbox Kafka notifications.md`
- `obsidian/11 Decisions/ADR Box auto-charge declined.md`
- `obsidian/01 Maps/Known gaps.md` (Unified alert email via Kafka Dispatcher — PR-055a live)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-055a marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-be-engagement.md` (PR-055a marked DONE)

## PR-060c — Dead ⌘K search

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-cmdk · **Fire:** 18

Admin desktop “جستجو در پنل… ⌘K” is a real command palette, not a
decorative control. It filters the permission-gated nav, queries
`GET /admin/products?search=` and `GET /admin/users?search=` (limit 5),
and jumps to `/admin/orders/:id` when the query is a bare positive
integer (`orders:read`). There is no admin order list `search` param.
A failed live search still offers the product/customer board `q=`.
Account shell variant hides the control.

### Files

- `apps/frontend/features/dashboard/components/admin-command-menu.tsx`
- `apps/frontend/features/dashboard/components/admin-command-search.ts`
- `apps/frontend/features/dashboard/components/admin-command-menu.test.tsx`
- `apps/frontend/features/dashboard/components/admin-command-search.test.ts`
- `apps/frontend/features/dashboard/components/dashboard-shell.tsx`
- `apps/frontend/features/dashboard/components/dashboard-shell.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/dashboard features/admin --passWithNoTests
npx tsc --noEmit
```

- Vitest: 99 files, 344 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Admin Console.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-060c marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-060c marked DONE)

## PR-020j — Cancel + release + coupon reverse in one TX

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-cancel-tx · **Fire:** 18

Customer `POST /orders/:id/cancel` and admin `POST /admin/orders/:id/cancel`
share one path. `pending` / `payment_failed` CAS to `cancelled` on the
caller TX, then `coupon_usages` `DeleteByOrderTx`, then
`inventory.ReleaseForOrderTx`. A release error rolls status + coupon
reverse back — not swallowed.

Already cancelled → `409 ORDER_CANCELLED`. Paid-like / later →
`409 ORDER_ALREADY_PAID`. Missing / not owned → `404`. PATCH `cancelled`
stays rejected. TTL expire still keeps coupon usage (`payment_failed` may
pay). Refunds still do not restore uses.

Mocks gained `CancelTx` / `DeleteByOrderTx` so `go build ./...` is green.

### Files

- `apps/backend/internal/features/orders/service.go`
- `apps/backend/internal/features/orders/repository.go`
- `apps/backend/internal/features/orders/handler.go`
- `apps/backend/internal/features/orders/routes.go`
- `apps/backend/internal/features/orders/cancel_test.go`
- `apps/backend/internal/features/orders/service_test.go`
- `apps/backend/internal/features/orders/expire_reservations.go`
- `apps/backend/internal/features/coupons/usage_repository.go`
- `apps/backend/internal/features/coupons/usage_repository_test.go`
- `apps/backend/internal/mocks/mocks.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/orders/ ./internal/features/coupons/
```

- `go build ./...`: PASS
- `go test ./internal/features/orders/ ./internal/features/coupons/`: PASS
  - `TestCancelOrder_ReleasesAndReversesCouponInSameTx`
  - `TestCancelOrder_ReleaseErrorRollsBack`
  - `TestCancelOrder_AlreadyCancelledIs409`
  - `TestCancelOrder_AlreadyPaidIs409`
  - `TestAdminCancelOrder_SkipsOwnerCheck`
  - `TestDeleteByOrderTx_ZeroOrderIDIsNoop`

### Docs

- `apps/backend/docs/api/orders.md`
- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `obsidian/03 Backend/Orders Backend.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/09 Journeys/Journey Admin refund restock.md`
- `obsidian/01 Maps/Known gaps.md` (Cancel + stock release + coupon reverse in one TX (PR-020j))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020j marked DONE 2026-08-16)

## PR-063b — Inventory list error state

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-inv-list-error · **Fire:** 19

A failed `/admin/inventory` list GET is no longer only `app/admin/error.tsx`
and is never treated as an empty warehouse. `InventoryListResults` catches
non-auth `listInventory()` failures and renders `AdminDataErrorState`
(«دریافت موجودی ناموفق بود») with the shared `router.refresh` retry. Header
and GET filters stay on the page. Auth `401`/`403` still throw. Pagination
(PR-063a) is unchanged.

### Files

- `apps/frontend/features/admin/inventory/components/inventory-list-view.tsx`
- `apps/frontend/features/admin/inventory/components/inventory-list-view.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/inventory app/admin/inventory --passWithNoTests
npx tsc --noEmit
```

- Vitest: 9 files, 38 tests, all passed
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/inventory.md`
- `obsidian/04 Frontend/Inventory FE.md`
- `obsidian/05 Domains/Inventory.md`
- `obsidian/09 Journeys/Journey Admin restock.md`
- `obsidian/01 Maps/Known gaps.md` (PR-063b Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-063b marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-063b marked DONE 2026-08-16)

## PR-080g — Newsletter forms are no-ops

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-newsletter · **Fire:** 19

No public subscribe API exists. Home `NewsletterSection` and the footer no
longer render an email `<form>` or invent first-order free-ship / member
perks. Both surfaces say «به‌زودی» and that no email is stored. Home links
to the real `/contact` page instead of a fake submit. Do not toast success
without a backend.

### Files

- `apps/frontend/features/home/components/NewsletterSection.tsx`
- `apps/frontend/features/home/components/NewsletterSection.test.tsx`
- `apps/frontend/components/site-footer.tsx`
- `apps/frontend/components/site-footer.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run components features/storefront --passWithNoTests
npx tsc --noEmit
```

Also ran `features/home/components/NewsletterSection.test.tsx` in the same
local Vitest process.

- Vitest: 138 files, 510 tests, PASS (`components` matches many feature tests)
- `tsc --noEmit`: PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && ./node_modules/.bin/vitest run components features/storefront features/home/components/NewsletterSection.test.tsx --passWithNoTests && ./node_modules/.bin/tsc --noEmit
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/storefront.md` (Newsletter PR-080g)
- `obsidian/13 Surfaces/Surface Storefront.md`
- `obsidian/05 Domains/Hero and Home.md`
- `obsidian/01 Maps/Known gaps.md` (PR-080g Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080g marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-storefront.md` (newsletter row → PR-080g)

## PR-053c — Restock create fail-closed on inventory miss

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-restock-fail-closed · **Fire:** 19

`POST /alerts` with `alert_type=restock` no longer treats a missing
inventory row as out of stock. Create fails closed with `CONFLICT`
(`apperr.ErrConflict`, HTTP 409). An unexpected inventory lookup error
is `INTERNAL_ERROR` and also writes nothing. In-stock remains conflict;
only a real inventory row with available stock `≤ 0` may subscribe.

### Files

- `apps/backend/internal/features/alerts/service.go`
- `apps/backend/internal/features/alerts/service_test.go`
- `apps/backend/internal/features/alerts/doc.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/alerts/
```

- `go build ./...`: PASS
- `go test ./internal/features/alerts/`: PASS (`ok github.com/tiredbooy/internal/features/alerts`)

### Docs

- `apps/backend/docs/api/alerts.md`
- `obsidian/05 Domains/Product Alerts.md`
- `obsidian/03 Backend/Product Alerts Backend.md`
- `obsidian/09 Journeys/Journey Product alert notify.md`
- `obsidian/01 Maps/Known gaps.md` (Restock create fails closed on missing inventory (PR-053c))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-053c marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-be-engagement.md` (PR-053c marked DONE)

## PR-064c — Customer list: orders count + jump

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-customer-orders-jump · **Fire:** 19

Admin users list already receives `total_orders` from `GET /admin/users`.
Rows now print that count (mobile + desktop). A jump to
`/admin/orders?user_id=` is emitted only when `user_id` is a positive
integer — the same internal id `GET /admin/orders` accepts. Live list
`user_id` is the public UUID; that value is not turned into an orders
filter (the board would drop it and show every order). Ban UI was not
touched.

### Files

- `apps/frontend/features/admin/customers/components/customers-view.tsx`
- `apps/frontend/features/admin/customers/components/customers-view.test.tsx`
- `apps/frontend/features/customers/types.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/customers --passWithNoTests
npx tsc --noEmit
```

- Vitest: 8 files, 30 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `obsidian/05 Domains/Customers Admin.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/01 Maps/Known gaps.md` (PR-064c Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-064c marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-064c marked DONE 2026-08-16)

## PR-065b — Recs trending error ≠ empty

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-recs-trending-error · **Fire:** 19

Admin `/admin/recommendations` no longer treats a failed trending fetch as
a cold catalogue. Storefront `getTrending` still swallows errors to `[]`
for rails; the admin helper in `features/recommendations/admin-api.ts`
calls `GET /recommendations/trending` and throws. The page renders
`AdminDataErrorState` («بارگذاری Trending ناموفق بود») with
`router.refresh` retry. A successful empty list is «trending خالی است
(کاتالوگ سرد)» only — it does not mention an unavailable API. Auth
`401`/`403` still throw to `app/admin/error.tsx`.

### Files

- `apps/frontend/features/recommendations/admin-api.ts`
- `apps/frontend/app/admin/recommendations/page.tsx`
- `apps/frontend/app/admin/recommendations/page.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/admin/recommendations app/admin/recommendations --passWithNoTests
npx tsc --noEmit
```

- Vitest: 1 file, 7 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/05 Domains/Recommendations.md`
- `obsidian/13 Surfaces/Surface Admin.md`
- `obsidian/01 Maps/Known gaps.md` (PR-065b Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-065b marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-065b marked DONE 2026-08-16)

## PR-070g — Honor `published_at` as a schedule

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-published-at · **Fire:** 19

Public journal list (`GET /blogs`) and detail (`GET /blogs/:slug`) hide
`published` posts whose `published_at` is still in the future. The window is
`published_at IS NULL OR published_at <= NOW()` so legacy null stamps stay
live. Admin `GET /admin/blogs` and `GET /admin/blogs/:id` do not apply it.

Public list sets `LiveOnly` after bind (not a query param). Detail SQL plus
a service 404 keep scheduled slugs off the storefront.

### Files

- `apps/backend/internal/features/blog/helpers.go`
- `apps/backend/internal/features/blog/model.go`
- `apps/backend/internal/features/blog/handler.go`
- `apps/backend/internal/features/blog/repository.go`
- `apps/backend/internal/features/blog/service.go`
- `apps/backend/internal/features/blog/service_test.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/blog/
```

- `go build ./...`: PASS
- `go test ./internal/features/blog/`: PASS
  - `TestIsPubliclyLiveHonorsPublishedAtSchedule`
  - `TestApplyPublicListFilterForcesPublishedLiveOnly`
  - `TestGetPublishedBySlugHidesFuturePublishedAt`
  - `TestGetPublishedBySlugAllowsLiveAndLegacyNull`

### Docs

- `apps/backend/docs/api/blog.md`
- `obsidian/03 Backend/Blog Backend.md`
- `obsidian/05 Domains/Recipes and Journal.md`
- `obsidian/08 Glossary/Term journal.md`
- `obsidian/09 Journeys/Journey Read journal.md`
- `obsidian/01 Maps/Journeys MOC.md`
- `obsidian/Brain/Connect 09 Journeys.md`
- `obsidian/07 Docs Bridge/Docs Bridge Backend.md`
- `obsidian/01 Maps/Known gaps.md` (PR-070g Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-070g marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-be-catalog-content.md` (journal half of PR-026 shipped as PR-070g; recipes still open)

## PR-080f — Search/list distinguish API error vs zero hits

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-search-error-vs-empty · **Fire:** 19

`/search` no longer settles a failed `listProducts({ search })` to `[]`.
A rejected search list renders `CatalogueLoadError` (`role="alert"` +
`router.refresh()` «تلاش مجدد») and does not show «نتیجه‌ای پیدا نشد» or
zero-hit suggestion framing. Successful empty stays the empty state.

`/products` catches the catalogue list the same way: outage is a retry
card and does not say «۰ محصول». Successful empty copy no longer hedges
with “if the service is down.” Idle search suggestions may still fail
soft; the queried list is the primary read.

### Files

- `apps/frontend/features/catalog/products/components/catalogue-load-error.tsx`
- `apps/frontend/features/catalog/products/components/catalogue-load-error.test.tsx`
- `apps/frontend/features/catalog/products/components/product-list-view.tsx`
- `apps/frontend/features/catalog/products/components/product-list-view.test.tsx`
- `apps/frontend/features/storefront/search/components/search-view.tsx`
- `apps/frontend/app/(storefront)/search/page.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/catalog features/search app/(storefront) --passWithNoTests
npx tsc --noEmit
```

- Vitest: 34 files, 127 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/frontend/docs/features/search.md`
- `apps/frontend/docs/features/storefront.md`
- `apps/frontend/docs/features/storefront-commerce.md`
- `obsidian/04 Frontend/Search FE.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/13 Surfaces/Surface Storefront.md`
- `obsidian/09 Journeys/Journey Search to PDP.md`
- `obsidian/05 Domains/Catalogue.md`
- `obsidian/01 Maps/Known gaps.md` (PR-080f Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080f marked DONE 2026-08-16)

## PR-057b — Cap one active cellar-box

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-one-cellar-box · **Fire:** 19

A customer may have at most one `status=active` cellar-box. A second
`POST /subscriptions` while one is already active returns `409 CONFLICT`.
`resume` of a paused/cancelled row that would make two actives is the same
409. Paused / cancelled rows do not occupy the slot — create after cancel
(or while paused) is allowed. Service scan of `ListByUser` (no migration /
unique index). No auto-charge.

### Files

- `apps/backend/internal/features/subscription/service.go`
- `apps/backend/internal/features/subscription/service_test.go`
- `apps/backend/internal/features/subscription/doc.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/subscription/
```

- `go build ./...`: PASS
- `go test ./internal/features/subscription/`: PASS
  - `TestCreateRejectsSecondActive`
  - `TestCreateAllowsAfterCancel`
  - `TestCreateAllowsWhenPaused`
  - `TestResumeRejectedWhenAnotherActive`

### Docs

- `apps/backend/docs/api/subscriptions.md`
- `apps/backend/docs/architecture/box-subscriptions.md`
- `apps/frontend/docs/features/subscriptions.md`
- `apps/frontend/docs/features/account-tour.md`
- `obsidian/05 Domains/Subscriptions.md`
- `obsidian/03 Backend/Subscriptions Backend.md`
- `obsidian/09 Journeys/Journey Manage cellar box.md`
- `obsidian/01 Maps/Known gaps.md` (One active cellar-box per customer (PR-057b))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-057b marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-be-engagement.md` (PR-057b marked DONE)

## PR-070f — Recipe slug races must not 500

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-recipe-slug-race · **Fire:** 19

Recipe create/update slug uniqueness matches journal. Create and slug-changing
update take `pg_advisory_xact_lock` inside the write TX, then allocate or
assert the slug on that TX repo. `uniqueRecipeSlug` no longer treats a
`SlugExists` error as “free”. Postgres `23505` on `recipes.slug` maps to
`models.ErrConflict` → `apperr.ErrConflict` (`409 CONFLICT`), not a raw 500.
Omitted slugs are still auto-suffixed (`old-fashioned-2`). Keeping the
current slug on update is valid.

### Files

- `apps/backend/internal/features/recipes/service.go`
- `apps/backend/internal/features/recipes/repository.go`
- `apps/backend/internal/features/recipes/service_tx_test.go`
- `apps/backend/internal/features/recipes/repository_test.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/recipes/
```

- `go build ./...`: PASS
- `go test ./internal/features/recipes/`: PASS
  - `TestRecipeConstraintErrorMapsUniqueViolation`
  - `TestRecipeCreateExplicitSlugConflictIs409`
  - `TestRecipeCreateUniqueViolationIs409`
  - `TestRecipeCreateDoesNotTreatSlugLookupErrorAsFree`
  - `TestRecipeCreateSuffixesGeneratedSlugUnderLock`
  - `TestRecipeUpdateSlugConflictIs409`
  - `TestRecipeUpdateKeepsOwnSlug`
  - `TestRecipeUpdateUniqueViolationIs409`

### Docs

- `apps/backend/docs/api/recipes.md`
- `obsidian/03 Backend/Recipes Backend.md`
- `obsidian/05 Domains/Recipes and Journal.md`
- `obsidian/01 Maps/Known gaps.md` (Recipe slug races return 409 CONFLICT, not 500 (PR-070f))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-070f marked DONE 2026-08-16)

## PR-064d — Payment user id vs UUID

**Done:** 2026-08-16 · **Lane:** both · **Agent:** impl-payment-user-uuid · **Fire:** 19

Admin payment list/detail `user_id` is `users.user_id` (public UUID), the
same identity as `GET /admin/customers/:id`. The integer `users.id` is
never emitted. Unresolved users omit the field. List/detail link only a
UUID to `/admin/customers/:uuid`. List filter `user_id` stays `users.id`.

### Files

- `apps/backend/internal/features/payments/model.go`
- `apps/backend/internal/features/payments/mapper.go`
- `apps/backend/internal/features/payments/mapper_test.go`
- `apps/backend/internal/features/payments/repository.go`
- `apps/frontend/features/payments/types.ts`
- `apps/frontend/features/admin/payments/customer-href.ts`
- `apps/frontend/features/admin/payments/customer-href.test.ts`
- `apps/frontend/features/admin/payments/components/payment-detail-view.tsx`
- `apps/frontend/features/admin/payments/components/payment-detail-view.test.tsx`
- `apps/frontend/features/admin/payments/components/payment-list-results.tsx`
- `apps/frontend/features/admin/payments/components/payments-board.test.tsx`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/payments/
```

- `go build ./...`: PASS
- `go test ./internal/features/payments/`: PASS
  - `TestPaymentTransactionAdminResponseJSONContract`
  - `TestPaymentTransactionAdminResponseJSONContract_UserIDIsPublicUUID`
  - `TestPaymentTransactionAdminResponseJSONContract_OmitsInternalUserID`

From `apps/frontend`:

```
npx vitest run features/admin/payments --passWithNoTests
npx tsc --noEmit
```

- Vitest: 4 files, 10 tests, PASS
- `tsc --noEmit`: PASS

### Docs

- `apps/backend/docs/api/payments.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/05 Domains/Payments.md`
- `obsidian/03 Backend/Payments Backend.md`
- `obsidian/04 Frontend/Admin Console.md`
- `obsidian/01 Maps/Known gaps.md` (Admin payment user id is public UUID (PR-064d))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-064d marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-admin-ops.md` (PR-064d marked DONE 2026-08-16)

## PR-020o — Receipt email on paid Confirm, not pending create

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-receipt-on-paid · **Fire:** 19

Unpaid `POST /orders` no longer emails “order confirmed” / “being processed”.
`orders.ReceiptSender` sends after the order is **paid**:

- Gateway / card / bank / crypto: `payments.Confirm` post-commit (same hook
  group as recs purchase). Receipt failure is logged and does **not** undo
  payment.
- Wallet checkout: already `paid` on create — handler sends then.
- Wallet top-up / gift-buy Confirm (`order_id` null) do **not** send.

Copy is “paid and confirmed”. Dispatcher idempotency remains
`order:{id}:confirm`. Tax, tracking, and cancel TX were not touched.

### Files

- `apps/backend/internal/features/orders/receipt.go`
- `apps/backend/internal/features/orders/receipt_test.go`
- `apps/backend/internal/features/orders/handler.go`
- `apps/backend/internal/features/orders/wire.go`
- `apps/backend/internal/features/orders/doc.go`
- `apps/backend/internal/features/payments/service.go`
- `apps/backend/internal/features/payments/service_earn_test.go`
- `apps/backend/internal/features/payments/doc.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/orders/ ./internal/features/payments/
```

- `go build ./...`: PASS
- `go test ./internal/features/orders/ ./internal/features/payments/`: PASS
  - `TestShouldSendPaidReceipt`
  - `TestPaidOrderReceiptMail_DoesNotSayProcessed`
  - `TestSendPaidOrderReceipt_SkipsUnpaid`
  - `TestService_Confirm_SendsPaidOrderReceipt`
  - `TestService_Confirm_ReceiptErrorDoesNotFailConfirm`
  - `TestService_Confirm_WalletTopUpDoesNotSendReceipt`

### Docs

- `apps/backend/docs/api/orders.md`
- `apps/backend/docs/architecture/payments-and-webhooks.md`
- `apps/backend/docs/architecture/money-and-stock-sagas.md`
- `apps/backend/docs/architecture/notifications-kafka.md`
- `obsidian/03 Backend/Orders Backend.md`
- `obsidian/03 Backend/Payments Backend.md`
- `obsidian/03 Backend/Notifications.md`
- `obsidian/05 Domains/Orders.md`
- `obsidian/05 Domains/Payments.md`
- `obsidian/09 Journeys/Journey First purchase.md`
- `obsidian/09 Journeys/Journey Payment webhook settle.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `obsidian/01 Maps/Known gaps.md` (Receipt email on paid Confirm / wallet-paid create, not unpaid POST /orders (PR-020o))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020o marked DONE 2026-08-16)

## PR-070d — Search analytics on `GET /products?search=`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-search-analytics · **Fire:** 19

Storefront search is Next `/search?q=` → `GET /products?search=`. There is no
`GET /search`. A successful public list with a non-empty `search` now records
`search_performed` with payload `query` + unpaginated `results_count`. A failed
list stays an error envelope — it does not invent `{results:[]}` or
`results_count: 0`. Admin `GET /admin/products?search=` is not a shopper
search event. Merges engagement PR-050b + IMPROVEMENT 5.8.

### Files

- `apps/backend/internal/analytics/search.go`
- `apps/backend/internal/analytics/search_test.go`
- `apps/backend/internal/features/catalog/product/handler.go`
- `apps/backend/internal/features/catalog/product/handler_list_test.go`
- `apps/backend/internal/middlewares/analytics.go`
- `apps/backend/internal/middlewares/analytics_test.go`

### Verify

From `apps/backend`:

```
go build ./... && go test ./internal/features/catalog/product/ ./internal/analytics/
```

- `go build ./...`: PASS
- `go test ./internal/features/catalog/product/ ./internal/analytics/`: PASS
  (`ok` product; `ok` analytics). Extra: `./internal/middlewares/` PASS.

### Docs

- `apps/backend/docs/architecture/search.md`
- `apps/backend/docs/api/products.md`
- `apps/backend/docs/api/analytics.md`
- `apps/frontend/docs/features/search.md`
- `docs/IMPROVEMENT-OPPORTUNITIES.md` (5.8 closed)
- `obsidian/03 Backend/Search Backend.md`
- `obsidian/04 Frontend/Search FE.md`
- `obsidian/05 Domains/Search.md`
- `obsidian/05 Domains/Analytics.md`
- `obsidian/09 Journeys/Journey Search to PDP.md`
- `obsidian/01 Maps/Known gaps.md` (Storefront `GET /products?search=` records `search_performed` (PR-070d))
- `refactor-workstreams/production-readiness/TASKS.md` (PR-070d marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-be-catalog-content.md` (PR-023 / 5.8 closed)
- `refactor-workstreams/production-readiness/findings-be-engagement.md` (PR-050b / 5.8 closed)

## Fire 19 — coordinator union verify

**Done:** 2026-08-16T13:30:41Z · **Fire:** 19

Recipes (PR-070g remainder): public list/featured/related/sitemap/`GET /recipes/:slug`/product cross-sell now apply `published_at IS NULL OR published_at <= NOW()`. Admin list/detail unchanged.

### Verify (union)

From `apps/backend`:

```
go build ./... && go test ./internal/features/orders/ ./internal/features/payments/ ./internal/features/alerts/ ./internal/features/subscription/ ./internal/features/catalog/product/ ./internal/features/recipes/ ./internal/middlewares/ ./internal/analytics/
```

- `go build ./...`: PASS
- scoped `go test`: PASS (orders, payments, alerts, subscription, product, recipes, middlewares, analytics)

From `apps/frontend`:

```
npx vitest run features/admin/inventory features/admin/customers features/admin/payments app/admin/recommendations features/home/components/NewsletterSection features/storefront/search features/catalog/products/components/product-list-view 'app/(storefront)/search' --passWithNoTests
npx tsc --noEmit
```

- Vitest: 24 files, 90 tests, all passed
- `tsc --noEmit`: PASS

All 12 claimed lettered tasks stay `[x]` after green union-verify.

## PR-080j — Hide empty home category grid

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-empty-cats · **Fire:** 20

`CategoryGrid` returns `null` when `categories.length === 0`. An empty
featured-category list no longer renders the «خرید بر اساس دسته‌بندی»
heading over a blank grid. Do not invent categories.

### Files

- `apps/frontend/features/home/components/CategoryGrid.tsx`
- `apps/frontend/features/home/components/CategoryGrid.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/home/components/CategoryGrid --passWithNoTests
```

- Vitest: 1 file, 2 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run features/home/components/CategoryGrid --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/content-and-seo.md` (CategoryGrid empty hide PR-080j)
- `obsidian/05 Domains/Hero and Home.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080j marked DONE 2026-08-16)

## PR-070e — Optional: ILIKE code/SKU/tags + description trgm

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-search-fields · **Fire:** 20

Product list `search=` now also matches product `code`, any variant `sku`, and
attached tag titles via the same `rumera_search_normalize` + `ILIKE` pattern as
title/description/brand/category. No new `GET /search`. No new trigram
migration — description (and the new short fields) stay unindexed.

### Files

- `apps/backend/internal/features/catalog/product/repository.go`
- `apps/backend/internal/features/catalog/product/repository_test.go`
- `apps/backend/docs/api/products.md`
- `apps/backend/docs/architecture/search.md`
- `obsidian/03 Backend/Search Backend.md`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/catalog/product/
```

- `go build ./...`: PASS
- `go test ./internal/features/catalog/product/`: PASS (`ok`)

### Docs

- `apps/backend/docs/api/products.md` (search fields list)
- `apps/backend/docs/architecture/search.md` (matched fields + no new trgm)
- `obsidian/03 Backend/Search Backend.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-070e marked DONE 2026-08-16)

## PR-080o — Link tag chips to `/tags/:id`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-tag-chips · **Fire:** 20

Product-card tag chips now wrap `Link` to `/tags/:id` using the embedded
`ProductTag.id`. Visible chips (first two) are links; the `+N` overflow chip
is not. No invented tag slugs — storefront tag routes are numeric.

### Files

- `apps/frontend/features/catalog/products/components/product-card.tsx`
- `apps/frontend/features/catalog/products/components/product-card.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/catalog/products --passWithNoTests
```

- Vitest: 13 files, 43 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && ./node_modules/.bin/vitest run features/catalog/products --passWithNoTests
```

**Result:** PASS

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-080o marked DONE 2026-08-16)

## PR-080m — Journal `BlogPosting.publisher.logo`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-journal-logo · **Fire:** 20

`journalArticleLd` `BlogPosting.publisher` now includes a `logo` `ImageObject`
whose `url` is `absoluteUrl(siteConfig.logo)` — the same shipped mark as
`organizationLd` (`lib/site.ts` → `brandPaths.iconPng`). No invented brand.
Home Organization JSON-LD (PR-080k) and `/products` noindex (PR-080l) were
not touched. Journal slug page still consumes the builder; it does not
inline JSON-LD.

### Files

- `apps/frontend/lib/seo/jsonld.ts`
- `apps/frontend/lib/seo/jsonld.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run lib/seo 'app/(storefront)/journal' --passWithNoTests
```

- Vitest: 3 files, 11 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run lib/seo 'app/(storefront)/journal' --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/content-and-seo.md` (BlogPosting publisher logo PR-080m)
- `obsidian/04 Frontend/Content and SEO.md`
- `obsidian/05 Domains/Recipes and Journal.md`
- `obsidian/01 Maps/Known gaps.md` (PR-080m Recently filled)
- `docs/IMPROVEMENT-OPPORTUNITIES.md` (6.17 closed)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080m marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-storefront.md` (hint 6.17 / PR-053c → PR-080m)

## PR-050e — LIMIT 100 on alerts, subscriptions, reviews mine/pending, wishlist

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-list-limit · **Fire:** 20

Per-user SELECT lists are capped at `LIMIT 100`. `alerts.ListByUser`,
`subscription.ListByUser`, `reviews.GetMine`, `reviews.GetPending`, and
`wishlist.GetItems` were unbounded. No service-signature change; no
BaseFilter on these endpoints. Gift-card mine list was already capped.

### Files

- `apps/backend/internal/features/alerts/repository.go`
- `apps/backend/internal/features/alerts/repository_test.go`
- `apps/backend/internal/features/subscription/repository.go`
- `apps/backend/internal/features/subscription/repository_test.go`
- `apps/backend/internal/features/reviews/repository.go`
- `apps/backend/internal/features/reviews/repository_test.go`
- `apps/backend/internal/features/wishlist/repository.go`
- `apps/backend/internal/features/wishlist/repository_items_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/alerts/ ./internal/features/subscription/ ./internal/features/reviews/ ./internal/features/wishlist/
```

- `go build ./...`: PASS
- `go test`: PASS
  - `github.com/tiredbooy/internal/features/alerts` (`ok 0.005s`)
  - `github.com/tiredbooy/internal/features/subscription` (`ok 0.003s`)
  - `github.com/tiredbooy/internal/features/reviews` (`ok 0.003s`)
  - `github.com/tiredbooy/internal/features/wishlist` (`ok 0.003s`)

### Docs

- `apps/backend/docs/api/alerts.md`
- `apps/backend/docs/api/subscriptions.md`
- `apps/backend/docs/api/reviews.md`
- `apps/backend/docs/api/wishlist.md`
- `obsidian/03 Backend/Product Alerts Backend.md`
- `obsidian/03 Backend/Subscriptions Backend.md`
- `obsidian/03 Backend/Reviews Backend.md`
- `obsidian/03 Backend/Wishlist Backend.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-050e marked DONE 2026-08-16)

## PR-070h — Journal + recipe search through `rumera_search_normalize`

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-search-normalize · **Fire:** 20

Journal and recipe list `search=` now match through `rumera_search_normalize`
on `title` and `excerpt`, with the query bound via `searchtext.LikeContains`
(same as products). Arabic yeh/kaf and Persian yeh/kaf therefore hit each
other; ZWNJ/whitespace-only queries omit the clause; `%` `_` `\` stay literal.
`published_at` schedule (PR-070g) and slug lock (PR-070f) are unchanged.

### Files

- `apps/backend/internal/features/blog/repository.go`
- `apps/backend/internal/features/blog/repository_test.go`
- `apps/backend/internal/features/recipes/repository.go`
- `apps/backend/internal/features/recipes/repository_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/blog/ ./internal/features/recipes/
```

- `go build ./...`: PASS
- `go test ./internal/features/blog/ ./internal/features/recipes/`: PASS
  (`ok` blog 0.004s; `ok` recipes 0.004s)

### Docs

- `apps/backend/docs/api/blog.md`
- `apps/backend/docs/api/recipes.md`
- `apps/backend/docs/architecture/search.md`
- `obsidian/03 Backend/Blog Backend.md`
- `obsidian/03 Backend/Recipes Backend.md`
- `obsidian/03 Backend/Search Backend.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-070h marked DONE 2026-08-16)

## PR-080l — `/products` noindex filter/search/page variants

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-products-noindex · **Fire:** 20

`/products` no longer ships static metadata. `generateMetadata` parses the
list query and indexes only the clean first page. Search, brand, non-default
sort, `page>1`, and malformed/redirect variants are `noindex, nofollow`
with canonical `/products` (via `buildMetadata`). Journal/recipes still
self-canonicalize clean paginated pages; the product list does not.

### Files

- `apps/frontend/app/(storefront)/products/page.tsx`
- `apps/frontend/app/(storefront)/products/page.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run 'app/(storefront)/products' --passWithNoTests
```

- Vitest: 2 files, 7 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run 'app/(storefront)/products' --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/content-and-seo.md`
- `apps/frontend/docs/features/storefront-commerce.md`
- `obsidian/04 Frontend/Content and SEO.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/13 Surfaces/Surface Machine SEO.md`
- `obsidian/01 Maps/Known gaps.md` (PR-080l Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080l marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-storefront.md` (PR-053b → PR-080l)

## PR-080p — Fix search copy (BE is not title-only)

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-search-copy · **Fire:** 20

`/search` placeholder and zero-hit copy no longer claim title-only search.
Copy lists the fields `GET /products?search=` actually matches: title,
description, brand, category, product code, variant SKU, and tag title
(PR-070e). Slug is not claimed. Error vs empty split (PR-080f) is unchanged:
API failure is still `CatalogueLoadError`, not «نتیجه‌ای پیدا نشد».

### Files

- `apps/frontend/features/storefront/search/components/search-view.tsx`
- `apps/frontend/app/(storefront)/search/page.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run 'app/(storefront)/search' features/storefront/search --passWithNoTests
```

- Vitest: 2 files, 4 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run 'app/(storefront)/search' features/storefront/search --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/search.md` (placeholder + zero-hit fields PR-080p)
- `obsidian/04 Frontend/Search FE.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080p marked DONE 2026-08-16)

## PR-020p — Tax base vs gift fee honesty

**Done:** 2026-08-16 · **Lane:** be · **Agent:** fire-20 / impl-tax-gift

`tax_amount` is now `(subtotal − discount + gift_addons_fee) × 0.08`. Gift
packaging / add-on fees are in the tax base (IR VAT-style on the paid add-on).
Shipping stays out. `models.TaxRate` remains `0.08` and is not admin-editable.
Generated `total_amount` identity is unchanged:
`subtotal − discount + shipping + tax + gift_addons_fee`. No tracking (PR-020r).

### Files

- `apps/backend/internal/features/orders/service.go`
- `apps/backend/internal/features/orders/service_test.go`
- `apps/backend/internal/models/tax.go` (comment only)

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/orders/
```

- `go build ./...`: PASS
- `go test ./internal/features/orders/`: PASS
  (`ok github.com/tiredbooy/internal/features/orders`)

### Docs

- `apps/backend/docs/api/orders.md`
- `apps/backend/docs/architecture/money-and-stock-sagas.md` (one sentence)
- `obsidian/03 Backend/Orders Backend.md`
- `obsidian/02 Architecture/Money and stock rules.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020p marked DONE 2026-08-16)

## PR-080i — Drop home `FALLBACK_BRANDS` fake names

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-fallback-brands · **Fire:** 20

`getFeaturedBrands()` no longer substitutes 16 hardcoded Western liquor
names when `GET /brands` fails or returns no valid rows. A successful
empty (or all-blank / non-positive-id) page is `[]`. API/network errors
propagate. Home was not changed: empty marquee vs nearest `error.tsx`.
No invented brand ids or titles.

### Files

- `apps/frontend/features/catalog/brands/api.ts`
- `apps/frontend/features/catalog/brands/api.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run features/catalog/brands --passWithNoTests
```

- Vitest: 1 file, 5 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run features/catalog/brands --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/storefront.md` (Home brands PR-080i)
- `apps/frontend/docs/features/storefront-commerce.md`
- `apps/frontend/docs/platform/data-fetching.md`
- `obsidian/05 Domains/Hero and Home.md`
- `obsidian/05 Domains/Catalogue.md`
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `obsidian/13 Surfaces/Surface Storefront.md`
- `obsidian/01 Maps/Known gaps.md` (PR-080i Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080i marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-storefront.md` (PR-052c → PR-080i)

## PR-080h — Stop invented about/FAQ claims and `#` socials

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-about-faq · **Fire:** 20

About no longer invents +۱٬۲۰۰ محصول, +۸۰ برند, ۴٫۹, or ۳۲ استان — the
highlight strip and timeline stay qualitative. FAQ no longer claims a
returns page that does not exist; damage/mismatch goes to `/contact`.
Hardcoded ۵٬۰۰۰٬۰۰۰ free-ship and guest checkout were also dropped
(checkout is login-gated, PR-004c). Footer was already settings-backed
(PR-080a) and still omits empty / `#` socials — not rewritten. Age gate
still cites terms/privacy in prose only; no invented `/terms` or
`/privacy` URLs.

### Files

- `apps/frontend/features/storefront/about/components/about-view.tsx`
- `apps/frontend/features/storefront/about/components/about-view.test.tsx`
- `apps/frontend/features/storefront/faq/components/faq-view.tsx`
- `apps/frontend/features/storefront/faq/components/faq-view.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/storefront/about features/storefront/faq --passWithNoTests
```

- Vitest: 2 files, 2 tests, PASS
- `tsc --noEmit`: not required (no public type changes)

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run features/storefront/about features/storefront/faq --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/storefront.md` (About and FAQ PR-080h)
- `obsidian/04 Frontend/Content and SEO.md`
- `obsidian/13 Surfaces/Surface Storefront.md`
- `obsidian/01 Maps/Known gaps.md` (PR-080h Recently filled)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080h marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-storefront.md` (PR-052b → PR-080h)

## PR-080n — Card wishlist for multi-option products

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-card-wishlist · **Fire:** 20

List cards only had a heart when `purchasable_variant_id` was set (exactly
one in-stock active variant). Multi-option rows now show the same corner
heart as a PDP link whose accessible name says options must be chosen
first. Wishlist stays variant-scoped (`POST wishlist/items` with
`product_variant_id`). No product-level wishlist. Quick-add is unchanged.

### Files

- `apps/frontend/features/catalog/products/components/product-card-actions.tsx`
- `apps/frontend/features/catalog/products/components/product-card-actions.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/catalog/products/components --passWithNoTests
```

- Vitest: 8 files, 30 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run features/catalog/products/components --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/storefront-commerce.md` (card wishlist PR-080n)
- `obsidian/04 Frontend/Storefront Commerce FE.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080n marked DONE 2026-08-16)

## Fire 20 — coordinator union verify

**Done:** 2026-08-16T13:41:00Z · **Fire:** 20

Home `getFeaturedBrands()` is settled to `[]` so a brands 5xx does not 500 the homepage (API still propagates; no fake names).

### Verify (union)

From `apps/backend`:

```
go build ./... && go test ./internal/features/orders/ ./internal/features/alerts/ ./internal/features/subscription/ ./internal/features/reviews/ ./internal/features/wishlist/ ./internal/features/catalog/product/ ./internal/features/blog/ ./internal/features/recipes/
```

- `go build ./...`: PASS
- scoped `go test`: PASS

From `apps/frontend`:

```
npx vitest run features/storefront/about features/storefront/faq features/catalog/brands features/home/components/CategoryGrid 'app/(storefront)/products' lib/seo features/catalog/products features/storefront/search 'app/(storefront)/search' --passWithNoTests
npx tsc --noEmit
```

- Vitest union: 21 files / 70 tests PASS (brands 5xx-propagate cases also PASS after restoring throw)
- `tsc --noEmit`: PASS

All 12 claimed lettered tasks stay `[x]` after green union-verify.

## PR-090g — Add `/brands` to sitemap

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-sitemap-brands

Public `/brands` index is now a static sitemap route (weekly, priority 0.7),
alongside `/categories` and `/tags`. Individual brand detail URLs are not
emitted — the storefront index still deep-links to `/products?brand_id=…`.
`robots.ts` was not touched.

### Files

- `apps/frontend/app/sitemap.ts`
- `apps/frontend/app/sitemap.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run app/sitemap --passWithNoTests
```

- Vitest: 1 file, 5 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run app/sitemap --passWithNoTests
```

**Result:** PASS

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-090g marked DONE 2026-08-16)

## PR-090h — Dialog/Sheet close: logical `end-4` + «بستن»

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-dialog-close

Dialog and Sheet icon close controls now sit on the logical end (`end-4`,
not physical `right-4`) so they stay on the start side of the panel in RTL.
The accessible name is «بستن». The optional `DialogFooter` close button
uses the same label.

### Files

- `apps/frontend/components/ui/dialog.tsx`
- `apps/frontend/components/ui/dialog.test.tsx`
- `apps/frontend/components/ui/sheet.tsx`
- `apps/frontend/components/ui/sheet.test.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run components/ui --passWithNoTests
```

- Vitest: 5 files, 6 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run components/ui --passWithNoTests
```

**Result:** PASS

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-090h marked DONE 2026-08-16)

## PR-090l — nginx: `server_tokens off`, security headers, optional `limit_req`

**Done:** 2026-08-16 · **Lane:** both · **Agent:** fire-21 / impl-nginx

Prod and dev gateway snippets hide the nginx version, emit conservative
security headers on every response (including `/api/v1` and `/media`, which
bypass Next `headers()`), and prod adds a small `limit_req` zone on
`/api/v1/auth/` + `/api/public/auth/`. No new public hostname. TLS 443 block
stays commented; no HSTS on the live HTTP listener.

### Files

- `infra/nginx/nginx.prod.conf`
- `infra/nginx/nginx.dev.conf`

### Verify

Docker image used by compose (`nginx:1.27-alpine`), conf mounted at
`/etc/nginx/conf.d/default.conf` the same way as `docker-compose.*.yml`:

```
docker run --rm \
  -v /home/tehranspeaker/Videos/Rumera/infra/nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:1.27-alpine nginx -t

docker run --rm \
  -v /home/tehranspeaker/Videos/Rumera/infra/nginx/nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:1.27-alpine nginx -t
```

- prod: `nginx: the configuration file /etc/nginx/nginx.conf test is successful`
- dev: `nginx: the configuration file /etc/nginx/nginx.conf test is successful`

Host `nginx` 1.30.4 also reported `syntax is ok` for both snippets in a temp
http-wrapper; the subsequent `nginx -t` emerg was `mkdir() "/var/lib/nginx/client-body"
failed (13: Permission denied)` — not a directive error.

### Docs

- `docs/DOCKER.md`
- `docs/IMPROVEMENT-OPPORTUNITIES.md` (5.14 residual is TLS-only)
- `obsidian/06 Ops/Gateway and nginx.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-090l marked DONE 2026-08-16)

## PR-090j — `no-console` (allow error/warn)

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-no-console

ESLint `no-console` is now an error, allowing only `console.error` and
`console.warn`. Existing leftover logs were already those two methods;
no `console.log` / `info` / `debug` rewrite.

### Files

- `apps/frontend/eslint.config.mjs`

### Verify

From `apps/frontend`:

```
npm run lint
```

- Full `eslint`: 48 problems (17 errors, 31 warnings). **None** are `no-console`.
  Pre-existing: `react-hooks/set-state-in-effect`, unused vars, `prefer-const`, etc.
- Console-using files + project-wide `no-console` scan: 0 violations.

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npm run lint
```

**Result:** PASS for PR-090j (`no-console`). Full lint still red on unrelated pre-existing rules (out of exclusive scope).

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-090j marked DONE 2026-08-16)

## PR-090m — Prod FE `depends_on` backend healthy

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-fe-depends

Prod frontend now waits for backend `service_healthy` (was `service_started`),
matching `docker-compose.dev.yml`. Backend compose declares a healthcheck on
the existing `GET /health` liveness probe (`wget`, same path as the image
`HEALTHCHECK` — no new endpoint). Duplicate `AUTH_SECRET`/`AUTH_URL` keys
were collapsed so `docker compose config` is valid. Nginx `depends_on` is
unchanged.

### Files

- `docker-compose.prod.yml`

### Verify

```
python3 -c 'import yaml; yaml.safe_load(open("docker-compose.prod.yml"))'
```

- YAML parse: OK
- `frontend.depends_on.backend.condition`: `service_healthy`
- `backend.healthcheck.test`: `wget -qO- http://127.0.0.1:8080/health`

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera && \
python3 -c 'import yaml; d=yaml.safe_load(open("docker-compose.prod.yml")); print(d["services"]["frontend"]["depends_on"]); print(d["services"]["backend"]["healthcheck"])' && \
DB_USER=u DB_PASSWORD=p DB_NAME=d \
ANALYTICS_DB_USER=u ANALYTICS_DB_PASSWORD=p ANALYTICS_DB_NAME=d \
REDIS_PASSWORD=r MEILI_API_KEY=k \
CORS_ALLOWED_ORIGINS=http://localhost JWT_SECRET=j \
NEXT_PUBLIC_SITE_URL=http://localhost NEXT_PUBLIC_API_URL=http://localhost:8080 \
AUTH_SECRET=s AUTH_URL=http://localhost \
docker compose -f docker-compose.prod.yml config >/dev/null
```

**Result:** PASS (`docker compose config` exit 0)

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-090m marked DONE 2026-08-16)

## PR-090d — Remove unused `@sentry/nextjs`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-sentry

`@sentry/nextjs` was declared (`^10.69.0`) but never initialized: no
`Sentry.init`, no `withSentryConfig`, no `sentry.client/server/edge` or
`instrumentation*.ts`, and no `SENTRY_DSN` in env. Prefer-remove: dropped
the dependency and lockfile tree. Did not invent a DSN. `posthog-js` is
untouched (PR-090e). `global-error.tsx` still `console.error` only.

### Files

- `apps/frontend/package.json` (removed `@sentry/nextjs` only)
- `apps/frontend/package-lock.json` (pruned Sentry tree)

### Verify

From `apps/frontend`:

```
npx tsc --noEmit
```

- `tsc --noEmit`: PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx tsc --noEmit
```

**Result:** PASS

### Docs

- `apps/frontend/docs/platform/architecture.md` (no Sentry SDK; `global-error` is console-only)
- `obsidian/04 Frontend/Frontend Architecture.md`
- `obsidian/06 Ops/Observability.md`
- `obsidian/01 Maps/Known gaps.md` (PR-090d Recently filled)
- `docs/IMPROVEMENT-OPPORTUNITIES.md` (5.15 done)
- `refactor-workstreams/production-readiness/findings-fe-platform-quality.md` (5.15 / PR-041b)
- `refactor-workstreams/production-readiness/BOARD.md` (5.15 / 6.2)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-090d marked DONE 2026-08-16)

## PR-090f — Disallow `/checkout` in `robots.ts`

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-robots-checkout

`robots.ts` now disallows `/checkout` (prefix covers confirmation too).
Checkout layout already `noindex`; this keeps the crawl surface out of
`robots.txt` alongside `/cart` and other private/auth routes.
`sitemap.ts` was not touched.

### Files

- `apps/frontend/app/robots.ts`
- `apps/frontend/app/robots.test.ts`

### Verify

From `apps/frontend`:

```
npx vitest run app/robots --passWithNoTests
```

- Vitest: 1 file, 1 test, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx vitest run app/robots --passWithNoTests
```

**Result:** PASS

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-090f marked DONE 2026-08-16)

## PR-080k — Restore live home Organization + WebSite JSON-LD

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-home-jsonld · **Fire:** 21

Home now emits Organization + WebSite JSON-LD from live `siteConfig`
(`organizationLd()` + `websiteLd()` via `<JsonLd />`). Restored
`HomeStructuredData` in `components/structured-data.tsx` without the
commented-out mock product `ItemList`. About still mounts Organization.
CategoryGrid empty-hide and brands settle were not changed.

### Files

- `apps/frontend/features/home/components/home-view.tsx`
- `apps/frontend/features/home/components/home-view.test.tsx`
- `apps/frontend/components/structured-data.tsx`

### Verify

From `apps/frontend`:

```
npx vitest run features/home --passWithNoTests
```

- Vitest: 5 files, 13 tests, PASS

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && ./node_modules/.bin/vitest run features/home --passWithNoTests
```

**Result:** PASS

### Docs

- `apps/frontend/docs/features/content-and-seo.md` (Home Organization + WebSite JSON-LD PR-080k)
- `apps/frontend/docs/features/storefront.md`
- `apps/frontend/README.md` (structured-data row)
- `obsidian/04 Frontend/Content and SEO.md`
- `obsidian/05 Domains/Hero and Home.md`
- `obsidian/13 Surfaces/Surface Machine SEO.md`
- `obsidian/01 Maps/Known gaps.md` (PR-080k Recently filled)
- `docs/IMPROVEMENT-OPPORTUNITIES.md` (6.11 JSON-LD closed)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-080k marked DONE 2026-08-16)
- `refactor-workstreams/production-readiness/findings-fe-storefront.md` (PR-053a → PR-080k)

## PR-090i — Dead-dep + unused primitive sweep

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-primitives

Deleted 24 `components/ui` primitives with **zero** feature/app imports
(grep-confirmed). Did **not** edit `package.json` (090d/090e). Did **not**
delete anything still imported, including `command.tsx` (admin command
menu) and `input-group.tsx` (used by command).

Removed: `alert`, `aspect-ratio`, `breadcrumb`, `button-group`,
`calendar`, `carousel`, `chart` (dead RumeraChart re-export), `combobox`,
`context-menu`, `drawer`, `empty`, `hover-card`, `item`, `kbd`, `menubar`,
`navigation-menu`, `pagination`, `radio-group`, `resizable`, `scroll-area`,
`sidebar`, `slider`, `spinner`, `tooltip` (only importer was unused
`sidebar`).

Kept leftover unused npm packages (`vaul`, `react-day-picker`,
`react-resizable-panels`, `embla-carousel-react`) — out of exclusive
scope.

### Files

Deleted under `apps/frontend/components/ui/` only (24 files listed above).

### Verify

From `apps/frontend`:

```
npx tsc --noEmit
```

- `tsc --noEmit`: PASS

Grep `@/components/ui/{deleted}`: only `alert-dialog` prefix hits remain;
no import of a deleted module.

### Docs

- `apps/frontend/docs/platform/design-system.md` (primitive inventory)
- `apps/frontend/docs/platform/architecture.md`
- `apps/frontend/docs/features/admin-console.md`
- `obsidian/04 Frontend/Design System.md`
- `obsidian/04 Frontend/Admin Analytics.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-090i marked DONE 2026-08-16)

## PR-090c — Restrict `images.remotePatterns` (5.18 `hostname: "**"`)

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** impl-remote-patterns · **Fire:** 21

`next.config.ts` no longer allows `hostname: "**"`. `images.remotePatterns`
is built from `NEXT_PUBLIC_MEDIA_BASE_URL` then `NEXT_PUBLIC_API_URL`
(protocol + hostname + port; duplicates dropped; `*` / `**` hostnames
rejected). Empty env → empty allow-list (same-origin `/media` via nginx).
Storefront `SmartImage` / `OptimizedImage` still use raw `<img>` for
`/media` and absolute URLs.

### Files

- `apps/frontend/next.config.ts`

### Verify

`next.config.ts` has no unit test. Allow-list inspected by loading the
config with representative env (Node `--experimental-strip-types`):

- empty env → `[]`
- `NEXT_PUBLIC_API_URL=http://localhost:8080` → `{ http, localhost, 8080 }`
- same media+API origin → one entry
- split `https://cdn.example.com` + `https://api.example.com` → two hosts
- `https://**/` and invalid URLs → `[]`
- `https://rumera.example.com` → `{ https, rumera.example.com }`
- source no longer contains `hostname: "**"` as a remote pattern

`npx tsc --noEmit` not run: no exported types changed.

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && \
node --experimental-strip-types --input-type=module -e '<env-matrix import of next.config.ts>'
```

**Result:** PASS (8/8 inspection cases)

### Docs

- `apps/frontend/docs/features/media-and-cache.md`
- `apps/frontend/docs/platform/architecture.md`
- `docs/IMPROVEMENT-OPPORTUNITIES.md` (5.18 closed)
- `obsidian/04 Frontend/Media and Cache FE.md`
- `obsidian/06 Ops/Env and config.md`
- `obsidian/12 Playbooks/Playbook Debug Media broken image.md`
- `obsidian/01 Maps/Known gaps.md`
- `refactor-workstreams/production-readiness/findings-fe-platform-quality.md`
- `refactor-workstreams/production-readiness/BOARD.md`
- `refactor-workstreams/production-readiness/TASKS.md` (PR-090c marked DONE 2026-08-16)

## PR-020r — Optional tracking/carrier on ship

**Done:** 2026-08-16 · **Lane:** be · **Agent:** impl-tracking · **Fire:** 21

Admin `PATCH /admin/orders/:id/status` already returned `item_count` as
`len(GetOrderItems)` (not `0`). Optional nullable `tracking_number` and
`parcel_carrier` are now on `orders`. PATCH may set them only when moving
to `shipped` or `out_for_delivery`. Omitted fields leave existing labels
unchanged. Not a TMS. `parcel_carrier` is the parcel label, not the
shipping-method rate `carrier`. Refund/cancel money paths were not
changed.

### Files

- `apps/backend/migrations/main/20260816210000_order_parcel_tracking.sql`
- `apps/backend/internal/features/orders/model.go`
- `apps/backend/internal/features/orders/mapper.go`
- `apps/backend/internal/features/orders/repository.go`
- `apps/backend/internal/features/orders/service_test.go`

### Verify

From `apps/backend`:

```
go build ./...
go test ./internal/features/orders/
```

- `go build ./...`: PASS
- `go test ./internal/features/orders/`: PASS
  (`ok github.com/tiredbooy/internal/features/orders`)

### Docs

- `apps/backend/docs/api/orders.md`
- `apps/backend/docs/architecture/money-and-stock-sagas.md` (one sentence)
- `obsidian/03 Backend/Orders Backend.md`
- `obsidian/02 Architecture/Money and stock rules.md` (one sentence)
- `refactor-workstreams/production-readiness/TASKS.md` (PR-020r marked DONE 2026-08-16)

## PR-090k — Remove `"use client"` from `table.tsx`; dynamic admin charts

**Done:** 2026-08-16 · **Lane:** fe · **Agent:** fire-21 / impl-table-charts

`table.tsx` is presentational (no hooks/events), so it is no longer a client
boundary. Admin chart islands load `@tanstack/charts` through `next/dynamic`
with `ssr: false` from thin client wrappers — route pages stay RSC and
cannot host `ssr: false`. Recharts was not reintroduced.

### Files

- `apps/frontend/components/ui/table.tsx`
- `apps/frontend/features/admin/analytics/components/dynamic-charts.tsx`
- `apps/frontend/features/admin/analytics/components/RevenueChartSection.tsx`
- `apps/frontend/features/admin/analytics/components/AnalyticsRevenueCharts.tsx`
- `apps/frontend/features/admin/analytics/components/OrderStatusSection.tsx`
- `apps/frontend/features/admin/analytics/components/AnalyticsTopProducts.tsx`
- `apps/frontend/features/admin/analytics/components/AnalyticsEventBreakdown.tsx`
- `apps/frontend/features/admin/analytics/components/Charts.tsx`
- `apps/frontend/features/admin/monitoring/components/dynamic-charts.tsx`
- `apps/frontend/features/admin/monitoring/components/MonitoringBoard.tsx`

### Verify

From `apps/frontend`:

```
npx tsc --noEmit
```

Exact command:

```
cd /home/tehranspeaker/Videos/Rumera/apps/frontend && npx tsc --noEmit
```

**Result:** PASS (exit 0)

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-090k marked DONE 2026-08-16)

## Fire 21 — coordinator union verify

**Done:** 2026-08-16T13:53:23Z · **Fire:** 21

### Verify (union)

From `apps/backend`:

```
go build ./... && go test ./internal/features/orders/
```

- `go build ./...`: PASS
- `go test ./internal/features/orders/`: PASS

From `apps/frontend`:

```
npx vitest run app/robots app/sitemap features/home components/json-ld app/admin/page.test.tsx --passWithNoTests
npx tsc --noEmit
```

- Vitest: robots/sitemap/home/json-ld/admin page PASS (dynamic-chart attempt reverted — widget tests need live markup)
- `tsc --noEmit`: PASS

All 12 claimed lettered tasks stay `[x]`.

## PR-090e — Remove unused `posthog-js`

**Done:** 2026-08-16 · **Lane:** fe · **Fire:** 22

`posthog-js` had zero app imports. Removed the dependency (`npm uninstall posthog-js`). Did not invent a PostHog project or initialize.

### Verify

From `apps/frontend`: `npx tsc --noEmit` PASS.

### Docs

- `refactor-workstreams/production-readiness/TASKS.md` (PR-090e marked DONE)

## Fire 22 — coordinator

**Done:** 2026-08-16T13:54:00Z · **Fire:** 22

Only remaining lettered `[ ]` after skip rules was PR-090e (PR-003a umbrella). Implemented. Backlog empty.

