---
tags:
  - moc
  - meta
  - gaps
aliases:
  - Missing notes
  - Vault gaps
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 01 Maps]]


# Known gaps

Living list. Prefer fixing items here over random notes. Procedure: [[How to add a note]].

---

## Recently filled (keep for history)

- nginx `server_tokens off` + edge security headers + prod auth `limit_req` (PR-090l)
- Home Organization + WebSite JSON-LD from live `siteConfig` (PR-080k)
- Unused `components/ui` primitives with zero imports removed (PR-090i)
- Journal `BlogPosting.publisher.logo` is the real `siteConfig.logo` ImageObject (PR-080m)
- Public recipes honor `published_at` as a schedule (PR-070g)
- Storefront `GET /products?search=` records `search_performed` (PR-070d)
- Receipt email on paid Confirm / wallet-paid create, not unpaid POST /orders (PR-020o)
- Recipe slug races return 409 CONFLICT, not 500 (PR-070f)
- Admin recs trending fetch error ≠ empty catalogue (PR-065b)
- Alert + cellar-box renewal mail via Dispatcher (PR-055a)
- Admin inventory list server page/search/`low_stock` (PR-063a)
- Admin inventory list fetch error ≠ empty warehouse (PR-063b)
- Server-side recs `purchase` on Confirm + `add_to_cart` on cart add (PR-050d)
- Product alerts domain + BE + journey  
- Subscriptions domain + BE + renewal journey (no auto-charge)  
- Referrals as own domain + BE + paid-order journey  
- Image uploader FE detail  
- Admin analytics FE  
- Age gate expanded  
- Wishlist stock playbook · admin refund restock journey  
- Env encyclopedia expansion · migration runbook  
- Incident playbook · security baseline ADR · performance/CWV note  
- CI/CD current-state note · Playwright status under [[Testing]]  
- Gateway/nginx · Makefile map (earlier)
- Admin product/recipe lookup selects (`limit≤100`, errors not swallowed)
- Admin product create/edit returns to `/admin/products` (PR-002a)
- Cart one-per-user `UNIQUE NOT NULL carts.user_id` (PR-004a add-to-cart 500)
- Store/admin BFF forward `Idempotency-Key` (PR-003c)
- Admin loyalty member search + account + paginated ledger (PR-003d)
- Admin loyalty adjust grant/clawback + actor/note/idempotency (PR-003e)
- Loyalty redeem spend `ref_id` scoped to user + required key (PR-003g)
- Cart/wishlist mutation errors use `cartMutationErrorMessage` (PR-004b)
- Admin `/admin/loyalty` programme fetch error/retry (PR-003k)
- Admin loyalty operator dashboard — member search / ledger / adjust (PR-003b)
- Persist loyalty programme rates/tiers + `enabled` (PR-003f)
- Confirm/referral earn retry + `payment_loyalty_awards` intent (PR-003h)
- Customer loyalty ledger pagination + `id` / `ref_type` / `ref_id` (PR-003j)
- Full `refunded` status claws order earn (PR-003i)
- Customer `GET /loyalty` `redeem_value` + rewards UI live Toman/point (PR-003l)
- Checkout payment step links to `/account/rewards` without unpaid earn copy (PR-003m)
- Editor aggregate + legacy product+variant create ensure a zero-stock inventory row (PR-010a)
- Cart unexpected SQL/repo errors logged; public 500 stays `INTERNAL_ERROR` (PR-010b)
- Admin product list server pagination + search (PR-011a)
- Product editor honors PRODUCTS_WRITE (PR-011b)
- Product option catalog failure no longer 500s the editor (PR-011c)
- Documented GET /admin/products, POST /cart/items/bulk, public GET /tags (PR-010f)
- Add-to-cart refuses inactive parent product (PR-010c)
- Auth-required cart documented as intended (PR-004c)
- Product category picker shows parent labels (PR-011d)
- Admin product list empty/error states (PR-011e)
- Cart line options hydrated (PR-010d)
- Wishlist line options hydrated (PR-058b)
- Brand PATCH title uniqueness excludes self (PR-010e)
- Lookup cap stays 100; FE pages (PR-010g not required)
- Admin monitoring time-series use TanStack Charts (PR-100e)
- Admin analytics orders bar is TanStack `barY` (PR-100c)
- Admin home 30d revenue area is TanStack `areaY` + `lineY` (PR-100b)
- Admin home order-status donut is TanStack `pie` / `radialArc` (PR-100d)
- `PATCH /subscriptions/:id` accepts `address_id` (PR-005c)
- Alert cron marks notified only after email send (PR-053a)
- MarkAsPaid sets paid_at (PR-020h)
- CORS allows Idempotency-Key (PR-040f)
- Self-service phone change requires OTP to the new number (PR-040i)
- Gateway intents include payment_url (PR-005a)
- Wallet checkout debits + marks paid in one TX (PR-020a)
- Subscription address change UI (PR-035b)
- FE consumes payment_url on top-up/gift (PR-030c)
- Coupon validate loads caller cart when IDs omitted (PR-020n)
- Confirmation copy matches order status (PR-030a)
- Tags/coupons/shipping gated by capability not admin role (PR-061a)
- Stock lines sorted by VariantID (PR-020k)
- Order PATCH status machine; money/cancel only via commands (PR-020l)
- Cancel + stock release + coupon reverse in one TX (PR-020j)
- Account cancel confirm + pending pay CTA (PR-033b)
- Wallet ledger server pagination (PR-035c)
- Ban/unban HTTP behind `customers:ban` (PR-040e)
- Admin customer ban/unban UI (PR-064b)
- Public review images hydrated (PR-051a)
- ForYou blends taste quiz (PR-052a)
- Dashboard analytics widgets gated (PR-060b)
- Admin customer write affordances match `customers:write` (PR-061c)
- Admin order ship-to + identity (PR-062a)
- Admin fulfillment vs refund UI (PR-062b)
- Storefront honors `maintenance.enabled` (PR-080b)
- Store BFF allow-lists `payments` (PR-090b)
- Category + recipe editors honor write (PR-061d)
- Journal detail + options list readable without write (PR-061e)
- Renewal cron advances only after email send (PR-057a)
- Empty account/checkout stub `api`/`types`/`validations` deleted (PR-035d)
- GET `/alerts` hydrates title/slug/variant price (PR-053b)
- Restock create fails closed on missing inventory (PR-053c)
- Admin review queue shows product title / slug (PR-063d)
- Referral claim returns `{claimed:true}` or `400` (PR-054a)
- Admin gift-card list + void confirm (PR-064a)
- Admin payment user id is public UUID (PR-064d)
- Admin order list server-side status/date/user filters (PR-062c)
- Dashboard low-stock widget shows product titles (PR-063c)
- Unknown recs interaction `product_id` is 404 (PR-058a)
- Admin order detail gift / notes / schedule (PR-062d)
- Storefront search/list API error ≠ zero hits (PR-080f)
- Journal public list/detail honor `published_at` as a schedule (PR-070g)
- One active cellar-box per customer (PR-057b)
- Admin customer list orders count + numeric jump (PR-064c)
- Storefront newsletter forms are honest «به‌زودی» stubs (PR-080g)
- About / FAQ no longer invent catalogue stats or a returns page (PR-080h)
- `/products` noindexes search/brand/sort/page variants (PR-080l)
- Home featured brands no longer invent Western liquor names (PR-080i)
- `images.remotePatterns` is media/API hosts only, not `**` (PR-090c)
- Unused `@sentry/nextjs` removed (never initialized; no DSN) (PR-090d)

---

## Still thin / future

| Gap | Notes |
|-----|--------|
| **Production hardening program** | **Lettered backlog complete** (PH-000…060). Matrix: `docs/PH-DUAL-DOC-MATRIX.md`. Tour: `docs/READ-THE-SYSTEM.md`. PH-043c closed (no auto-charge). |
| **Models ownership** | **PH-012a complete** — feature-local domain types; `internal/models` shared-only + package doc. |
| **Error mapping** | **PH-012b complete** — feature handlers use `httpx.HandleError`. |
| **User-clear errors** | **PH-012c/d complete** — BE codes + FE `user-facing-error` on money paths. Residual: NextAuth login code passthrough. |
| **Fire-and-forget safety** | **PH-013a complete** — `pkg/async` recover + GoCtx; OTP/email/counters/analytics wired. |
| **Loyalty earn triggers** | **PH-040a–e done** (rules, BE, FE UX, admin rates, Prometheus hooks + event schema). **PR-003d live** — admin member search / account / paginated ledger. **PR-003e live** — signed admin adjust. **PR-003g live** — user-scoped redeem `ref_id` + required key. **PR-003f live** — DB programme + `enabled` kill-switch (env is seed only). **PR-003h live** — Confirm writes `payment_loyalty_awards` in the money TX and retries `AwardForOrder` / `OnPaidOrder`; leftover rows stay pending; referral Awards both sides before Complete. **PR-003i live** — full `refunded` status claws order earn (balance only). **PR-003j live** — customer `GET /loyalty/transactions` is `{results, pagination}` with `id` / `ref_type` / `ref_id`. **PR-003l live** — `GET /loyalty` includes `redeem_value`; rewards UI no longer hardcodes 1000. Residual: analytics DB insert. |
| **Idempotency platform** | **PH-011 complete** (scoped keys, mounts, UNIQUE tx id, terminal ACK, runbook + API dual-doc). **PR-003c done** — store/admin BFF forward `Idempotency-Key`. **PR-003g done** — redeem spend `ref_id` is `{userID}:idem:{key}` and key is required. **PR-040f done** — CORS allows `Idempotency-Key`. Residual: FE `RequireKey` flip. |
| **Architecture deep-dive refresh** | Feature-slice architecture must land in vault + `apps/backend/docs` (PH-000) |
| **Subscription charging** | **PH-043a–c done.** Cron emails only; auto-charge **declined** ([[ADR Box auto-charge declined]]). **PR-005c live** — `PATCH /subscriptions/:id` accepts `address_id`. **PR-035b live** — account card picker PATCHes `{ address_id }` on active/paused. **PR-057a live** — `next_renewal_at` rolls only after reminder Send. **PR-055a live** — renewal mail via Dispatcher when wired. **PR-057b live** — one `status=active` cellar-box per customer; second create/resume is `409 CONFLICT`. Residual: list LIMIT; optional unique partial index on active `(user_id)`. |
| **Gift card purchase** | **PH-042a–b done** (API + storefront purchase/mine/redeem). **PR-005a live** — `payment_url` on purchase intent. **PR-030c live** — FE «پرداخت در درگاه» only when URL is non-empty. **PR-005b live** — gift code emailed after paid fulfill (new issue only; replay does not resend). Residual: container `WithMailer`/`WithDispatcher` wire (PR-020a). |
| **Gateway wallet top-up** | **PH-041a–b done** (API + storefront presets/pending). **PR-005a live** — `payment_url` on top-up intent. **PR-030c live** — FE «پرداخت در درگاه» only when URL is non-empty. Empty URL = pending copy only. |
| **Inventory / checkout weight** | **PH-020a–c done** (admin wire + FE signal + checkout package weight sum). Residual: products still missing kg need staff fix. |
| **Search quality / Meili** | **PH-030a–b done** — ILIKE Persian baseline + Meili client/reindex readiness. **Cutover** still deferred (dual-path checklist in search.md). |
| **Unified alert email via Kafka Dispatcher** | **PR-055a live** — alert + cellar-box renewal mail prefer `notifications.Dispatcher` (outbox when async). Residual: none for this gap. |
| **Full STRIDE threat model** | Baseline only in [[ADR Security posture baseline]] |
| **Numeric CWV budgets** | Intent captured in [[Performance and CWV]] — no lab SLOs yet |
| **Playwright command runbook** | Blocked on Task 062 suite landing |
| **RMA/return state machine** | Only manual inventory `refund` adjust |
| **Multi-warehouse** | Deferred — not now |
| **Multi-currency** | Deferred — Toman only for now |
| **Crypto payments** | Maybe later — not now |

## Intentionally out of scope

- Full API field catalogs (use `apps/backend/docs/api/`)
- CI / deploy workflows until there is a server (founder decision 2026-08-11)
- Netflix-style digital subscriptions
- Multi-currency / multi-warehouse / crypto (for now)
- Dataview/Canvas as primary UX (Graph is enough)
- Treating refactor task trackers as product notes (except this program’s charter is linked from gaps for agents)

---

## Related

[[How to add a note]] · [[Map of Content]] · [[00 Home]] · [[Agent onboarding]]

#gaps #meta
