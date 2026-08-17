# Production readiness — ordered backlog

**Workstream:** `production-readiness-20260816`  
**Created:** 2026-08-16  
**Mode:** **Active loop** — 1-minute interval, **10–14 agents** per fire, Phase 0 → 11 until no open `[ ]` tasks. Every agent must test. See `AUTO_LOOP.md`.

Claim order is **top → bottom**. Letter IDs are claimable; phase headings are not.

**Related closed work (do not re-do unless a new live bug is proven):**

- Backend feature architecture BE-000…044
- Refactor-Docs 000–086a (085a absorbed by PH-020)
- Production-hardening PH-000…PH-060 (PH-043c = no tokenized auto-charge)

**Source of Phase 0:**
`refactor-workstreams/READ_THIS_BEFORE_CHANGES.txt`

**Audit wave 1:** `be-catalog-cart` · `be-loyalty-money` · `fe-admin-catalog` · `fe-cart-loyalty`  
**Audit wave 2 (whole project):** `be-money-ops` · `be-identity-security` · `be-catalog-content` · `be-engagement` · `fe-storefront` · `fe-commerce-account` · `fe-admin-ops` · `fe-platform-quality`

Reports: `findings-*.md` in this folder.

**ID map (wave 2 remapped so agents do not collide):**

| Range | Theme |
| --- | --- |
| PR-001…011 | Wave 1 (founder + first four lanes) |
| PR-020a–s | Checkout / money / stock |
| PR-030…035 | Checkout + account FE |
| PR-040a–i | Identity / security |
| PR-050…058 | Engagement / recs / alerts / subs leftover |
| PR-060…065 | Admin console (non-product) |
| PR-070a–h | Catalog / content leftover (was agent PR-020–027) |
| PR-080a–p | Storefront FE (was agent PR-050–054) |
| PR-090a–m | Platform / a11y / DevOps FE (was agent PR-040–048) |

---

## How to read this backlog

| Column | Meaning |
| --- | --- |
| **Lane** | `be` backend · `fe` frontend · `both` contract |
| **Effort** | S ≤½ day · M 1–3 days · L multi-day |
| **Severity** | P0 blocks selling · P1 operator/trust · P2 polish |

Every future implementation ends with:

- [ ] Project docs updated (`apps/backend/docs` and/or `docs/` / FE docs)
- [ ] Obsidian brain updated (domain / architecture / journey / ADR as needed)
- [ ] Local verify (`go build` / scoped tests / FE checks as relevant)

---

# Phase 0 — Founder-reported blockers (root causes found)

### Task Group PR-001 — Admin product form lookups empty

- [x] **PR-001a — Brand (and category) select stays empty** · **both** · **P0** · **S** · **DONE 2026-08-16**  
  - Report: brand picker empty even when brands exist.  
  - **Cause:** RSC `fetchList("/brands?limit=200")` (same for `/categories`)
    hits `httpx.validBaseQuery` (`limit` max 100) → `400 INVALID_QUERY`.
    `product-editor-view.tsx` swallows the error → `[]`.  
  - Admin `/admin/brands` works because it uses `limit: 100`. Envelope
    `{results, pagination}` is correct. No `GET /admin/brands` exists.  
  - Fix: request `limit≤100` (page if needed), **do not** catch-all to `[]`,
    show error/empty in `SearchableIdSelect`.

- [x] **PR-001b — Tag select stays empty** · **both** · **P0** · **S** · **DONE 2026-08-16**  
  - Report: tag picker empty even when tags exist.  
  - **Cause:** tags are not in `loadProductLookups`. `TagSelector` →
    `useAllTags` → `GET /api/admin/tags?limit=100` (legal). BE public
    `GET /tags` is fine. Silent empty is the second client hop + swallowed
    errors. `listAllTags` also crashes if `pagination` is missing.  
  - Fix: load tags server-side with `limit≤100`; keep TagSelector error UI;
    guard pagination.

- [x] **PR-001c — Same `limit=200` swallow on categories + recipe tags** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  - Product-form categories share PR-001a. Recipe editor
    `listTags({ limit: 200 })` will 400 the same way.  
  - Shared admin lookup helper (`limit≤100`, no swallow).

### Task Group PR-002 — Product save must return to the list

- [x] **PR-002a — After successful create/edit, go to `/admin/products`** · **fe** · **P1** · **S**  DONE
  - **Cause:** create does `router.push(/admin/products/${saved.id})`;
    edit stays + `refresh()`. Tests lock the editor destination.  
  - FE-only. Update `ProductForm.tsx` + `ProductForm.*.test.tsx`.  
  - Cancel already goes to the list. Toasts are real, not fake.

### Task Group PR-003 — Loyalty must be complete (admin first)

- [x] **PR-003a — Loyalty backend completeness vs live FE needs** · **be** · **P1** · **M–L** · **DONE 2026-08-16 (umbrella)**  
  - Closed by **PR-003d–j** (members, adjust, persist, spend scope, earn
    retry, refund clawback, paginated ledger). Not implemented as a unit.

- [x] **PR-003b — Admin loyalty dashboard is a real operator surface** · **fe** · **P1** · **M–L** · **DONE 2026-08-16**  
  - `/admin/loyalty` is a read-only env poster (`LoyaltyProgrammeView`).  
  - After **PR-003d/e**: member search, member ledger, signed adjust
    (mirror `WalletCreditForm`). UUID user ids. `{results, pagination}`.  
  - **No PUT programme in v1** (PR-003f can stay later).

- [x] **PR-003c — Store/admin BFF must forward `Idempotency-Key`** · **both** · **P0** · **S** · **DONE 2026-08-16**  
  - Store/admin BFF copy incoming `Idempotency-Key` via
    `pickIdempotencyKeyHeader`. They do not invent a key.

### Task Group PR-004 — Add-to-cart 500

- [x] **PR-004a — UNIQUE on `carts.user_id` (this is the 500)** · **be** · **P0** · **S–M** · **DONE 2026-08-16**  
  - Report: product-card add-to-cart → `INTERNAL_ERROR` 500.  
  - **Cause:** `GetOrCreate` uses `ON CONFLICT (user_id)` but
    `carts.user_id` is only a non-unique index. Postgres fails; service
    maps to bare `ErrInternal`. Same path as `GET /cart`.  
  - Cards **do** send a real `purchasable_variant_id`. Guest is 401, not
    this 500. Stock misses are already 4xx.  
  - Fix: UNIQUE + NOT NULL (guests stay unsupported) + DB test for
    `GetOrCreate` / `POST /cart/items`.

- [x] **PR-004b — Human add-to-cart errors (leftovers)** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  - Button already maps `INTERNAL_ERROR` to Persian; founder JSON is the
    HTTP body, not the toast.  
  - Leftovers: wishlist add swallows stock codes; cart line qty/remove
    uses generic strings, not `cartMutationErrorMessage`.

---

# Phase 1 — Loyalty operator + money safety

- [x] **PR-003d — Admin member search + account + paginated ledger** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  - `GET /admin/loyalty/members`, member GET, member transactions.  
  - Envelope `{results, pagination}`. Member id = **UUID** (same as wallet
    credit / `/admin/customers/:id`).

- [x] **PR-003e — Admin adjust (grant/clawback) + actor/note/idempotency** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  - `POST /admin/users/:userID/loyalty/adjust` (`customers:write`, UUID).  
  - Grant increases lifetime; clawback does not. Header + body key;
    201 first apply / 200 replay.

- [x] **PR-003f — Persist programme rates/tiers + `enabled`** · **be** · **P1** · **L** · **DONE 2026-08-16**  
  - Env-only today; SQL tiers hardcoded. Cannot disable.  
  - FE agreed: **not required for v1 admin**. Do after 003d/e.

- [x] **PR-003g — Scope spend `ref_id` to userID; require key on redeem** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  - Ledger UNIQUE is global `(reason, ref_type, ref_id)`. Spend uses
    `{userID}:idem:{key}`. Missing key → `400`. No nano fallback.

- [x] **PR-003h — Earn reliability after Confirm / referral** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  - `AwardForOrder` is fire-and-forget after payment commit. Referral
    `Complete` then Award can orphan points. Outbox or retry.

- [x] **PR-003i — Call `ClawbackOrderEarn` on full `refunded` status** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  - Helper exists; `UpdateOrderStatus` is status-only. Do not build a
    full refund saga here.

- [x] **PR-003j — Customer ledger pagination + `id`/`ref_type`/`ref_id`** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  - Hard 50 rows, refs stripped.

- [x] **PR-003k — `/admin/loyalty` error state** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  - Programme fetch has no try/catch → blank RSC error.

- [x] **PR-003l — Stop hardcoding redeem Toman (`POINT_VALUE = 1000`)** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  - `rewards-view.tsx`. Needs rates on `GET /loyalty` or a customer
    programme GET (may need a small BE field).

- [x] **PR-003m — Checkout: link to rewards; no unpaid earn copy** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  - Earn is after `payments.Confirm`. Do not invent points on checkout.

---

# Phase 2 — Catalog / cart production holes (agent audit)

### Task Group PR-010 — Catalog + cart extras

- [x] **PR-010a — `EnsureForVariant` on aggregate / legacy variant create** · **be** · **P0** · **M** · **DONE 2026-08-16**  
  - Standalone variant create writes inventory; editor aggregate does not.
    New products can have no inventory row → not purchasable.

- [x] **PR-010b — Do not collapse cart SQL errors to bare INTERNAL_ERROR** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  - Wrap + log the cause; keep the public 500 envelope.

- [x] **PR-010c — Refuse add-to-cart when parent product is inactive** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  - Line can insert then vanish on `GetItems` (`p.is_active = true` join).

- [x] **PR-010d — Hydrate cart line `options`** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  - Docs + FE `cart-lines` already expect them; `GetItems` never loads them.

- [x] **PR-010e — Brand PATCH title uniqueness must exclude self** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  - Same-title PATCH conflicts with itself (tags already exclude id).

- [x] **PR-010f — Document `GET /admin/products` + cart bulk + public brand/tag lists** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  - Routes exist; API docs omit them.

- [x] **PR-010g — Optional lookup cap >100** · **be** · **P2** · **S** · **DONE 2026-08-16 — not required; FE pages at 100**  
  - Only if FE refuses to page at 100. **Not** required to fix PR-001.

- [x] **PR-004c — Document auth-required cart as intended** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  - No guest/cookie cart unless product asks.

- [x] **PR-004d — Wishlist add-to-cart uses mapped cart errors** · **fe** · **P2** · **S** · **DONE 2026-08-16 with PR-004b**  
  - `wishlist-view.tsx` swallows `OUT_OF_STOCK` / `PRODUCT_UNAVAILABLE`.

### Task Group PR-011 — Admin product polish

- [x] **PR-011a — Product list server pagination + search** · **both** · **P1** · **M** · **DONE 2026-08-16**  
  - `GET /admin/products?limit=100` + client-only filter drops extra rows.

- [x] **PR-011b — Product editor respects `PRODUCTS_WRITE`** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  - Edit page is `PRODUCTS_READ` only; form has no `canWrite`.

- [x] **PR-011c — Option catalog must not 500 the product form** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  - `getProductOptionCatalog` N+1; any throw takes down the editor.

- [x] **PR-011d — Category picker: tree / parent labels** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  - Flat `/categories` vs the tree operators already have on `/admin/categories`.

- [x] **PR-011e — Product list empty/error states** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  - Failed fetch is only `app/admin/error.tsx`; empty copy is generic.

---

# Phase 3 — Adjacent money (real residuals, not PH rewrites)

- [x] **PR-005a — Payment-start URL on wallet top-up + gift purchase (and checkout)** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  - Intents have no `payment_url`. Customer cannot actually pay. New work,
    not a PH-041/042 rewrite.

- [x] **PR-005b — Email gift code after paid fulfill** · **be** · **P2** · **M** · **DONE 2026-08-16**  
  - `giftcard` has zero notify calls. Buyer must poll `/gift-cards/mine`.

- [x] **PR-005c — `PATCH /subscriptions/:id` accept `address_id`** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  - Lifecycle-only today. Active box cannot change ship-to. Not PH-043c.

---

# Phase 4 — Checkout cannot close a sale (wave 2 · money)

Selling is **not closable**. `POST /orders` reserves stock and leaves the order
`pending`. Default FE rail is wallet; `wallet.Purchase` is never called. There
is no customer pay / pay-again route. Confirmation still says the order is
confirmed.

- [x] **PR-020a — Wallet checkout must debit + mark paid + deduct in one TX** · **be** · **P0** · **M** · **DONE 2026-08-16**  
  Reject insufficient funds before reserve commit.

- [x] **PR-020b — Per-order reservation identity; failed webhook must not steal stock** · **be** · **P0** · **L** · **DONE 2026-08-16**  
  Fail → `payment_failed` without a stealable committed counter.

- [x] **PR-020c — Reservation TTL sweeper** · **be** · **P0** · **M** · **DONE 2026-08-16**  
  Expire unpaid pending: release stock, reverse coupon, fail dangling payment.

- [x] **PR-020d — Real admin refund command** · **be** · **P0** · **L** · **DONE 2026-08-16**  
  `POST /admin/orders/:id/refund`: wallet + restock + coupon policy + **PR-003i**.
  Stop treating PATCH status as refund.

- [x] **PR-020e — Shipping region: address province vs `IR` vs `IR-TEH`** · **both** · **P0** · **M** · **DONE 2026-08-16**  
  Checkout `country=IR` vs zones `IR-TEH` → empty quotes / `INVALID_SHIPPING`.

- [x] **PR-020f — Persist pending payment in create TX; `POST /orders/:id/pay`** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  Return `{payment_id, transaction_id}` on the order. Pairs with **PR-005a**.

- [x] **PR-020g — Checkout currency `IRT` not `USD`** · **be** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-020h — `MarkAsPaid` sets `paid_at`** · **be** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-020i — Snapshot ship-to; GET includes address / user / method / coupon / payment** · **be** · **P1** · **M** · **DONE 2026-08-16**

- [x] **PR-020j — Cancel + release + coupon reverse in one TX** · **be** · **P1** · **M** · **DONE 2026-08-16**

- [x] **PR-020k — Sort stock lines by VariantID (IMPROVEMENT 5.5)** · **be** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-020l — Allowed status transitions; refund/cancel only via money commands** · **be** · **P1** · **M** · **DONE 2026-08-16**

- [x] **PR-020m — `GetStockLines` from `order_items` only** · **be** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-020n — Coupon validate loads caller cart when IDs omitted** · **be** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-020o — Receipt email on paid Confirm, not pending create** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-020p — Tax base vs gift fee honesty** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-020q — `isBusinessError` use `errors.Is` (6.4)** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-020r — Optional tracking/carrier on ship** · **be** · **P2** · **M** · **DONE 2026-08-16**

- [x] **PR-020s — Paginate low-stock + variant movements** · **be** · **P2** · **S** · **DONE 2026-08-16**

---

# Phase 5 — Checkout + account honesty (wave 2 · FE)

- [x] **PR-030a — Confirmation must match order status** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  Pending must not say «سفارش تأیید شد».

- [x] **PR-030b — Do not imply wallet already paid** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  Until **PR-020a**.

- [x] **PR-030c — Consume `payment_url` after PR-005a** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  Top-up + gift pending CTA when URL present. Checkout has no field (PR-020f). Confirmation is PR-030a.

- [x] **PR-030d — Honest bank-transfer / operator-wait copy** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-030e — Fire `purchase` recs only after paid** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  Pairs with **PR-050d**.

- [x] **PR-031a — Optimistic cart qty/remove + per-line busy + undo** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  IMPROVEMENT 5.10. Also finishes PR-004b leftovers.

- [x] **PR-032a — Account overview RSC prefetch + HydrationBoundary** · **fe** · **P2** · **M** · **DONE 2026-08-16**  
  IMPROVEMENT 5.16.

- [x] **PR-033a — Order tabs must not client-filter one page** · **both** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-033b — Cancel confirm + pending pay CTA** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-034a — Surface real login/OTP errors; bounce signed-in users** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-034b — Validate reset token on load** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-035a — Account alerts list/delete** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-035b — Subscription address change UI (after PR-005c)** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-035c — Wallet ledger server pagination** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-035d — Delete empty account/checkout stub modules** · **fe** · **P2** · **S** · **DONE 2026-08-16**

---

# Phase 6 — Identity / security (wave 2)

- [x] **PR-040a — Prod `TRUSTED_PROXIES` + nginx so login/OTP limits cannot be XFF-spoofed** · **be** · **P0** · **S** · **DONE 2026-08-16**

- [x] **PR-040b — Do not put the Go access JWT on `/api/auth/session`** · **both** · **P0** · **M** · **DONE 2026-08-16**  
  Same finding from identity + platform agents.

- [x] **PR-040c — Staff `customers:write` vs user mutations vs wallet credit** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  Staff 403s on user mutations but can still credit wallets.

- [x] **PR-040d — Subscription create: own `address_id` (like checkout)** · **be** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-040e — Implement ban/unban or remove dead `customers:ban`** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-040f — CORS Allow-Headers include `Idempotency-Key`** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  Pairs with **PR-003c**.

- [x] **PR-040g — Throttle refresh/logout/validate; dummy bcrypt on login miss** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-040h — Review `image_url` https/`/media` allow-list** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-040i — Phone change requires OTP to the new number** · **be** · **P2** · **M** · **DONE 2026-08-16**

---

# Phase 7 — Engagement / recs / alerts / subs leftover (wave 2)

- [x] **PR-050c — Persist analytics `sid`/`did` + BFF cookie passthrough** · **both** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-050d — Server-side purchase on Confirm + add_to_cart** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  FE already fires some; BE does not own purchase-on-pay.

- [x] **PR-050e — LIMIT 100 on alerts, subscriptions, reviews mine/pending, wishlist** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  IMPROVEMENT 6.8 still live.

- [x] **PR-051a — Hydrate public review images** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  Public review `images` is always `[]`.

- [x] **PR-051b — Fix reviews.md 403-on-create docs** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-051c — Review unlike** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-052a — Blend taste profile into ForYou** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  Taste quiz is never read by ForYou.

- [x] **PR-053a — Do not MarkNotified unless alert email actually sent** · **be** · **P0** · **S** · **DONE 2026-08-16**  
  Cron marks `notified_at` even when `mailer == nil`.

- [x] **PR-053b — Enrich GET /alerts with title/slug/price** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  GET `/alerts` was variant-id only; account list needed a second hop for title/slug/price.

- [x] **PR-053c — Restock create fail-closed on inventory miss** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  Missing inventory row was treated as OOS and the restock alert was created.

- [x] **PR-054a — Referral claim `claimed` or 400** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  Claim was always 204; invalid / already-claimed was a silent success.

- [x] **PR-055a — Alert + renewal mail through dispatcher** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  Alert restock/price + cellar-box renewal mail prefer `notifications.Dispatcher` (outbox when async). Fail closed: no MarkNotified / AdvanceRenewal unless dispatch/send succeeded.

- [x] **PR-056a — Admin gift-card list + void** · **be** · **P2** · **M** · **DONE 2026-08-16**  
  Not PR-005b (email).

- [x] **PR-057a — Do not advance box renewal if email failed / mailer nil** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  Cron rolled `next_renewal_at` even when `mailer == nil` or Send failed.

- [x] **PR-057b — Cap one active cellar-box** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  Second `POST /subscriptions` while the caller already has `status=active` is `409 CONFLICT`. Resume of another row that would make two actives is the same 409.

- [x] **PR-058a — 404 unknown interaction product_id** · **be** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-058b — Hydrate wishlist `options`** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  - Docs + FE `wishlist` types already expect them; `GetItems` never loaded them (cart analogue of PR-010d).


---

# Phase 8 — Admin console leftover (wave 2)

Epic 2 mock admin data / fake «نمونه» toasts are **gone**. Remaining is RBAC + thin contracts.

- [x] **PR-060a — Dashboard module cards use session permissions** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  Today uses `permissionsForRole("admin")` so every staffer sees every card.

- [x] **PR-060b — Gate dashboard analytics widgets** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-060c — Dead ⌘K search** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-061a — Tags / coupons / shipping: `requirePermission`, not `role === "admin"`** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  Seed + nav grant the caps; BE allows them; pages send staff to `/forbidden`.

- [x] **PR-061b — Payments + gift-cards page gates** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  Only `requireStaff` today.

- [x] **PR-061c — Customer write affordances match capabilities** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-061d — Category + recipe editors honor write (like PR-011b)** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-061e — Journal detail + options list readable without write** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-062a — Render identity + ship-to after PR-020i** · **fe** · **P0** · **M** · **DONE 2026-08-16**  
  Admin cannot fulfill: DTO has no customer/address/method.

- [x] **PR-062b — Fulfillment vs refund UI after PR-020d/l** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  Status dropdown can mark `refunded` with a real toast and no money.

- [x] **PR-062c — Server-side order filters** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-062d — Render gift / notes / schedule already on the DTO** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-063a — Inventory server pagination + `search` / `low_stock`** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  `listAllInventory()` downloads every page.

- [x] **PR-063b — Inventory list error state** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-063c — Dashboard low-stock titles** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-063d — Review queue product label** · **both** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-064a — Gift-card operator list (after PR-056a)** · **both** · **P2** · **M** · **DONE 2026-08-16**  
  Paginated `GET /admin/gift-cards` + confirm `POST /:id/void`. Real errors, no fake ledger.

- [x] **PR-064b — Ban UI after PR-040e** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-064c — Customer list: orders count + jump** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-064d — Payment user id vs UUID** · **both** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-065a — Settings RSC error + send `expected_updated_at`** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  Pairs with **PR-070b**.

- [x] **PR-065b — Recs trending error ≠ empty** · **fe** · **P2** · **S** · **DONE 2026-08-16**

---

# Phase 9 — Catalog / content leftover (wave 2)

- [x] **PR-070a — Price filter: inactive variants must not match** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  `min_price`/`max_price` are two independent EXISTS.

- [x] **PR-070b — Site-settings last-write-wins (IMPROVEMENT 5.9)** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  Get → merge → upsert, no row lock. Clobbers gift prices.

- [x] **PR-070c — Slugify product slug; refuse active product without slug** · **be** · **P1** · **M** · **DONE 2026-08-16**  
  Empty slug = no PDP.

- [x] **PR-070d — Search analytics on `GET /products?search=`** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  Classifier wants `/api/v1/search`; storefront never hits it. Merges engagement
  PR-050b + IMPROVEMENT 5.8.

- [x] **PR-070e — Optional: ILIKE code/SKU/tags + description trgm** · **be** · **P2** · **M** · **DONE 2026-08-16**  
  Product `search=` also matches code, variant SKU, and tag titles. No new
  `GET /search`. No new trgm (description still unindexed).

- [x] **PR-070f — Recipe slug races must not 500** · **be** · **P1** · **S** · **DONE 2026-08-16**  
  Unique slug race on create/update is `409 CONFLICT`, not `500`.

- [x] **PR-070g — Honor `published_at` as a schedule** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  Public journal list/detail hide future `published_at`. Admin still sees them.

- [x] **PR-070h — Journal + recipe search through `rumera_search_normalize`** · **be** · **P2** · **S** · **DONE 2026-08-16**  
  Journal + recipe list `search=` uses `rumera_search_normalize` + `searchtext.LikeContains` so Arabic-yeh/kaf match Persian titles.

---

# Phase 10 — Storefront (wave 2)

- [x] **PR-080a — Wire `GET /settings` into storefront chrome** · **fe** · **P0** · **M** · **DONE 2026-08-16**  
  Maintenance ignored; hardcoded 5M free-ship; `#` socials.

- [x] **PR-080b — Honor `maintenance.enabled`** · **fe** · **P0** · **S** · **DONE 2026-08-16**

- [x] **PR-080c — Replace `/contact` 404 with settings-backed contact** · **fe** · **P0** · **S** · **DONE 2026-08-16**

- [x] **PR-080d — Settle `getCategoryTree` in the storefront layout** · **fe** · **P0** · **S** · **DONE 2026-08-16**  
  Uncaught throw can 500 the whole public site.

- [x] **PR-080e — Category missing from tree → `notFound()`** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-080f — Search/list distinguish API error vs zero hits** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-080g — Newsletter forms are no-ops** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-080h — Stop invented about/FAQ claims and `#` socials** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-080i — Drop home `FALLBACK_BRANDS` fake names** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-080j — Hide empty home category grid** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-080k — Restore live home Organization + WebSite JSON-LD** · **fe** · **P1** · **S** · **DONE 2026-08-16**  
  Home mounts `organizationLd()` + `websiteLd()` from live `siteConfig` via
  `<JsonLd />`. No mock product ItemList.

- [x] **PR-080l — `/products` noindex filter/search/page variants** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-080m — Journal `BlogPosting.publisher.logo`** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  `journalArticleLd` publisher is `Organization` + `ImageObject` logo from
  `siteConfig.logo` (same URL as `organizationLd`). No invented brand.

- [x] **PR-080n — Card wishlist for multi-option products** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  Multi-option cards now show a corner heart that links to the PDP and says
  options must be chosen. Wishlist stays variant-scoped; no product-level add.

- [x] **PR-080o — Link tag chips to `/tags/:id`** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-080p — Fix search copy (BE is not title-only)** · **fe** · **P2** · **S** · **DONE 2026-08-16**

---

# Phase 11 — Platform / a11y / DevOps FE (wave 2)

- [x] **PR-090a — Inject `AUTH_SECRET` + `AUTH_URL` into prod frontend compose** · **both** · **P0** · **S** · **DONE 2026-08-16**  
  Dev has them; prod compose omits them.

- [x] **PR-090b — Allow-list `payments` on store BFF when PR-005a lands** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-090c — Restrict `images.remotePatterns` (5.18 `hostname: "**"`)** · **fe** · **P1** · **S** · **DONE 2026-08-16**

- [x] **PR-090d — Wire Sentry or remove `@sentry/nextjs`** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  Removed unused `@sentry/nextjs`. No `SENTRY_DSN` in env; SDK was never initialized.

- [x] **PR-090e — Remove unused `posthog-js` (or initialize)** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  Unused `posthog-js` removed. No initialize path — zero app imports.

- [x] **PR-090f — Disallow `/checkout` in `robots.ts`** · **fe** · **P2** · **S** · **DONE 2026-08-16**  
  Page already `noindex`.

- [x] **PR-090g — Add `/brands` to sitemap** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-090h — Dialog/Sheet close: logical `end-4` + «بستن»** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-090i — Dead-dep + unused primitive sweep** · **fe** · **P2** · **M** · **DONE 2026-08-16**

- [x] **PR-090j — `no-console` (allow error/warn)** · **fe** · **P2** · **S** · **DONE 2026-08-16**

- [x] **PR-090k — Remove `"use client"` from `table.tsx`; dynamic admin charts** · **fe** · **P2** · **S–M** · **DONE 2026-08-16**

- [x] **PR-090l — nginx: `server_tokens off`, security headers, optional `limit_req`** · **both** · **P2** · **M** · **DONE 2026-08-16**

- [x] **PR-090m — Prod FE `depends_on` backend healthy** · **fe** · **P2** · **S** · **DONE 2026-08-16**

---

# Phase 12 — TanStack Charts across admin (founder 2026-08-16)

Replace **recharts** with **`@tanstack/charts` v0.14** (grammar of graphics, `defineChart` + `@tanstack/charts/react`).
Use it on every admin dashboard / analytics / monitoring chart. Keep gold/wine tokens, RTL, `faNum`, `prefers-reduced-motion`, Persian tooltips.

Docs: https://tanstack.com/charts/latest

### Task Group PR-100 — TanStack Charts admin

- [x] **PR-100a — Install + Rumera chart kernel** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  - `@tanstack/charts` is already in `package.json` (0.14.0).  
  - Add `apps/frontend/lib/charts/` : theme (gold/wine CSS vars), reduced-motion, RTL `dir`, `faNum` tick helpers, thin `<RumeraChart definition ariaLabel />` wrapper.  
  - `next.config.ts` `optimizePackageImports`: add `@tanstack/charts`, drop `recharts` only after 100f.  
  - Do not rewrite feature charts here.

- [x] **PR-100b — Revenue area chart** · **fe** · **P1** · **M**  
  - New `RevenueAreaChart.tsx` using `areaY` + `lineY` (or areaY only) + tooltip.  
  - Wire `RevenueChartSection` (dashboard 30d). Keep ChartCard chrome.

- [x] **PR-100c — Orders bar chart** · **fe** · **P1** · **M**  
  - New `OrdersBarChart.tsx` using `barY` / `bar`.  
  - Wire `AnalyticsRevenueCharts` (both series cards).

- [x] **PR-100d — Order-status donut** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  - New `DonutChart.tsx` + legend (pie / center-donut marks).  
  - Wire `OrderStatusSection`. Center total stays.

- [x] **PR-100e — Monitoring time-series** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  - Rewrite `MonitoringCharts.tsx` (req/s, 5xx %, p95) with TanStack area/line.  
  - Same empty states; `fa-IR` time labels.

- [x] **PR-100f — Rankings + delete recharts** · **fe** · **P1** · **M** · **DONE 2026-08-16**  
  - Horizontal ranking bars (TanStack `barX` or keep CSS bars if cleaner — prefer TanStack).  
  - Wire `AnalyticsTopProducts` + `AnalyticsEventBreakdown`.  
  - Remove `recharts` from `package.json` / `components/ui/chart.tsx` once no imports remain.  
  - Dual-doc FE admin analytics + Obsidian.

---

### P0 first (cannot sell / cannot operate / security)
1. **PR-020a** wallet debit on checkout  
2. **PR-004a** cart UNIQUE (add-to-cart 500)  
3. **PR-030a + PR-030b** stop lying that the order is paid  
4. **PR-020e** shipping region (`IR` vs `IR-TEH`)  
5. **PR-001a → PR-001b → PR-001c** empty admin lookups  
6. **PR-003c + PR-040f** Idempotency-Key BFF + CORS  
7. **PR-040a** trusted proxies / rate-limit spoof  
8. **PR-040b + PR-090a** JWT not in browser session; prod AUTH_SECRET  
9. **PR-061a** staff locked out of tags/coupons/shipping  
10. **PR-080d** storefront layout 500 on category tree  
11. **PR-053a** alert cron marks notified without sending  
12. **PR-020b → PR-020c** reservation identity + TTL  

### Founder leftovers
13. **PR-002a** navigate to `/admin/products`  
14. **PR-004b** human cart errors leftover  
15. **PR-100a–f** TanStack Charts on admin (parallel panel)  

### Close the money loop
15. PR-005a → PR-020f → PR-030c → PR-090b  
16. PR-020d → PR-003i → PR-062b  
17. PR-020i → PR-062a  
18. PR-020g/h/j/k/l  

### Loyalty + admin operator
19. PR-003d → PR-003e → PR-003b  
20. PR-061b–d · PR-060a  
21. PR-003g → PR-003h → PR-003k/l  

### Catalog / storefront / platform
22. PR-010a · PR-080a–c · PR-080f  
23. PR-070b + PR-065a · PR-070c/d · PR-011*  
24. PR-090c/d · remaining P1  
25. P2 polish last (PR-020m–s, 031–035, 050–058 leftover, 063–065, 070e–h, 080g–p, 090e–m)

---

# Explicit non-goals (this program)

- [x] No CI/workflows (founder: no server)  
- [x] No guest/cookie cart unless product asks  
- [x] No tokenized box auto-charge (PH-043c)  
- [x] No Netflix-style loyalty entitlements  
- [x] No product-duplicate list action (intentionally omitted)  
- [x] Do not change paginated envelope `{results, pagination}`  
- [x] Do not invent `GET /admin/brands` / `GET /admin/tags` unless FE refuses public lists  
- [x] Do not reopen Epic 2 mock admin data (verified gone)  
- [x] Do not reopen 5.7 reviews/mine (verified live)  
- [x] Do not reopen 6.11 mock featured bottles (verified gone)  
- [x] Do not reopen 6.18 slug fallback (exact slug lookup exists)  

---

The auto-loop claims **10–14** non-overlapping lettered tasks per fire.
Each implementer must run scoped tests (`go test` / `vitest`) and must not
mark `[x]` if verify is red.
Each task: implement → verify → dual-doc → `FINISHED.md` → `[x]` on this file.
