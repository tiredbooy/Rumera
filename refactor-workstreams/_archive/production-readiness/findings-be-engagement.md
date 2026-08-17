# Findings — `be-engagement`

**Agent:** be-engagement  
**Workstream:** `production-readiness-20260816`  
**Date:** 2026-08-16  
**Mode:** investigation only (no application code)

Lane: reviews, wishlist, recommendations, taste, alerts, referral, analytics
(events + search summaries), notifications, `internal/corn` jobs,
`internal/analytics` queue, subscription leftover, giftcard leftover.

Did **not** reopen PR-003\* loyalty, PR-005a–c money residuals, PR-010d cart
options, PH-000…060, BE-000…044, or Refactor-Docs 000–086a unless a **new**
live bug is shown.

**ID note:** Wave 2 other lanes claimed PR-020–027 (catalog-content + money-ops),
PR-030 (fe-commerce), PR-040a–i (identity). Engagement tasks are **PR-050+**.
Overlaps to merge, not duplicate:

- Search analytics on `GET /products?search=` = catalog-content **PR-023**
  (I keep cookies + filter payload as PR-050c / extras).
- Subscription create `address_id` ownership = identity **PR-040d**.
- Review `image_url` scheme allow-list = identity **PR-040h** (not the empty
  images array — that is PR-051a).

Board posts (hello / mid / done) are also in
`BOARD-posts-be-engagement.md` for append if the live `BOARD.md` raced.

---

## What I inspected

| Area | Paths |
|------|--------|
| Composition | `apps/backend/internal/routes/routes.go`, `bootstrap/{newRouter,container,app,setupMiddlewares}.go` |
| Reviews | `internal/features/reviews/{routes,handler,service,repository,mapper,model,image_repository}.go` |
| Wishlist | `internal/features/wishlist/{routes,handler,service,repository,model}.go` + `migrations/main/20260526174551_create_wishlists.sql` |
| Recs | `internal/features/recommendations/{routes,handler,service,repository,model}.go` + `internal/corn/recommendation_job.go` |
| Taste | `internal/features/taste/{routes,handler,service,model}.go` |
| Alerts | `internal/features/alerts/{routes,handler,service,repository,model}.go` + `internal/corn/alert_check_job.go` |
| Referral | `internal/features/referral/{routes,handler,service,model}.go` |
| Analytics | `internal/features/analytics/{routes,handler,event_service,search_summary_*}.go`, `internal/middlewares/analytics.go`, `internal/analytics/queue.go`, `internal/corn/{search_job,stats_job}.go` |
| Notifications | `internal/notifications/{dispatcher,handler,event}.go`, `cmd/notification-worker/main.go` |
| Subscription leftover | `internal/features/subscription/{routes,handler,service,repository,model}.go`, `internal/corn/subscription_renewal_job.go` |
| Giftcard leftover | `internal/features/giftcard/{routes,handler,service,repository}.go` |
| FE contracts | `features/{reviews,recommendations,product-alerts,subscriptions,referral,taste,wishlist,storefront/search,cart,checkout,gift-cards}/*` |
| Docs / hints | `docs/IMPROVEMENT-OPPORTUNITIES.md` 5.7 / 5.8 / 5.19 / 6.8, `apps/backend/docs/api/reviews.md` |

---

## IMPROVEMENT re-verify (hint list dated 2026-06-20)

### 5.7 Missing `reviews/mine`, `reviews/pending`, bare `recommendations` — **FIXED**

Stale `account-hooks.ts` is gone. Live BE + FE:

| Call | Mounted | FE caller |
|------|---------|-----------|
| `GET /reviews/mine` | `reviews.RegisterCustomer` | `features/reviews/client.ts` |
| `GET /reviews/pending` | same | same |
| `GET /recommendations/for-you` | `recommendations.RegisterCustomer` | `features/recommendations/client.ts` |

Envelope `{ data: [...] }`. Item shape `RecommendationItem.product_id` on both
sides. **Do not re-open 5.7 as a missing-route bug.** Residual: unbounded
lists (PR-050e). Evidence: `reviews/routes.go:22-23`,
`recommendations/routes.go:20`, `routes.go:152-153`.

`fe-commerce-account` independently confirmed the same verdict.

### 5.8 Empty analytics `Payload` — **closed PR-070d** (search classification)

Middleware no longer writes a permanently empty map
(`middlewares/analytics.go`): copies `AnalyticsPayloadKey`, sets
`product_id` from context / `:id`. `GET /products?search=` is
`search_performed` with `query` + `results_count` (no `GET /search`).

Residual (not PR-070d): `filter_name` / `filter_value` still unused
(search_job common-filters). `sid`/`did` cookies are PR-050c.

Product views work (`product/handler.go:129,152`). Orders set line payload
(`orders/handler.go:74-81`). Queue + cron are wired.

**6.4 in this lane is gone:** `search_summary_repository.go:138` uses
`errors.Is`.

**Overlap:** catalog-content **PR-023** is the same search-classification
fix. Merge; keep cookies as PR-050c.

### 5.19 `purchase`(10) / `add_to_cart`(4) never recorded — **DONE PR-050d**

Weights still `add_to_cart=4`, `purchase=10`. FE may still fire. **BE owns
paid purchase:** `payments.Confirm` records `purchase` per distinct order-line
`product_id`. Cart `AddItem` / bulk add records `add_to_cart`. Unpaid
checkout and orderless Confirm do not write. Inserts are idempotent.

### 6.8 Per-user lists unbounded — **STILL LIVE** (wider than the hint)

| Repo | File | LIMIT |
|------|------|-------|
| `alerts.ListByUser` | `alerts/repository.go:63-68` | **none** |
| `subscription.ListByUser` | `subscription/repository.go:56` | **none** |
| `reviews.GetMine` | `reviews/repository.go:424-438` | **none** |
| `reviews.GetPending` | `reviews/repository.go:453-475` | **none** |
| `wishlist.GetItems` | `wishlist/repository.go:80-111` | **none** |

Gift-card `ListByPurchaser(..., 50)` is already capped.

---

## Live surface

### Reviews

Public: `GET /products/:id/reviews` (paginated approved), `/summary`,
`GET /reviews/:id` (approved). Customer: mine, pending, create, patch, delete,
react, images. Admin: list + `PATCH /admin/reviews/:id/status`.

Gin `/reviews/mine` + `/reviews/:id` register without panic.

`POST /reviews` allows non-buyers (`service.go:49-51`). Docs still say 403.

`Review.Images` is `db:"-"`. List/detail never hydrate `review_images`.
Public `images` is always `[]`. Image GET is JWT-only.

### Wishlist

`wishlists.user_id` **is UNIQUE**. `ItemResponse.options` is documented; SQL
never loads options (wishlist analogue of PR-010d).

### Recommendations

Public trending / similar / FBT. Customer for-you, interactions, profile.
Admin `GET /admin/recommendations/stats`. Taste package is **never imported**.

### Taste / alerts / referral

`GET·PUT /me/taste-profile` (missing → empty object). `GET·POST /alerts`,
`DELETE /alerts/:id`. `GET /referrals/me`, `POST /referrals/claim` (always 204).

### Analytics

Admin-only under `/admin/analytics` + `analytics:read`. No customer ingest
API. Middleware is global (`newRouter.go:53`).

### Subscription leftover (not PR-005c, not PH-043c)

`GET/POST /subscriptions`, `PATCH` lifecycle + address. Address ownership is
**PR-040d**. **PR-057b live** — at most one `status=active` cellar-box;
second create / resume is 409. Renewal job advances only after send
(**PR-057a** / **PR-055a**).

### Gift leftover (not PR-005b)

Issue + redeem + purchase + `GET /gift-cards/mine` (cap 50). No admin list/void.

---

## New live bugs

### PR-050b / catalog PR-023 — Search analytics never sees a search (P1) — **DONE PR-070d**

Classify `GET /products` with non-empty `search` as `search_performed`.
Set payload `{query, results_count}`. Do not invent `GET /search`.

### PR-050c — Analytics `sid`/`did` never persist (P1)

`SetCookie` (HttpOnly, Secure in prod, SameSite, `cookieTTL`). BFF must
forward Cookie / Set-Cookie.

### PR-050d — Record `add_to_cart` + `purchase` on the server (P1) — **DONE**

After **Confirm** (paid), insert `purchase` per distinct product_id.
Optionally `add_to_cart` in `cart.AddItem`. Idempotent so FE retries do not
double-weight. Unpaid checkout must not count.

### PR-050e — Cap per-user lists (P2)

`LIMIT 100` on alerts, subscriptions, reviews mine/pending, wishlist items.

### PR-051a — Public review `images` is always `[]` (P1)

Hydrate images on approved list/detail, or add public `GET /reviews/:id/images`.

### PR-051b — reviews.md 403-on-create is false (P2)

### PR-051c — React cannot unlike (P2)

### PR-052a — Taste quiz orphaned from `ForYou` (P1)

### PR-053a — Alert cron marks notified without a send (P0)

```25:51:apps/backend/internal/corn/alert_check_job.go
	if j.mailer != nil {
		if err := j.mailer.Send(...); err != nil {
			continue
		}
	}
	sent = append(sent, a.ID)
```

`mailer == nil` → every pending alert stamped, never emailed.

### PR-053b — Alert list is variant-id only (P2)

### PR-053c — Restock create skips inventory errors (P2) · **DONE**

Missing inventory is `CONFLICT` (not implicit OOS). Lookup errors are `INTERNAL_ERROR`. No row written.

### PR-054a — Referral claim indistinguishable (P2)

Always 204. No referee list.

### PR-055a — Alert + subscription mail bypass dispatcher (P1)

Only OTP / password-reset / order-confirmed event types exist.

### PR-056a — Gift admin is issue-only (P2)

`GET /admin/gift-cards` + void. Not PR-005b email.

### PR-057a — Renewal advances after failed email (P1)

### PR-057b — Unlimited active cellar-boxes (P2) — **DONE**

### PR-058a — Interaction insert does not check product exists (P2)

### PR-058b — Wishlist `options` never hydrated (P2)

---

## Cron / queue

Jobs when `CRON_ENABLED`: product_stats, revenue_stats, search_summary
(empty until PR-023/050b; N+1 per term), recommendation_refresh,
idempotency_cleanup, alert_check (PR-053a), subscription_renewal (PR-057a),
meili_reindex, loyalty_birthday (PR-003).

Queue: 10k, drop-on-full, 4 workers, 3s/250 flush. Shutdown drains.

Middleware labels almost every request `page_viewed` (admin/health included).

---

## FE ↔ BE contract sheet

| Endpoint | Auth | Success | Notes |
|----------|------|---------|-------|
| GET `/reviews/mine` | JWT | `{data: AccountReview[]}` | no page; no `title` |
| GET `/reviews/pending` | JWT | `{data: PendingReview[]}` | delivered only |
| POST `/reviews` | JWT | 201 `{data: Review}` | non-buyers ok; `images:[]` |
| GET `/products/:id/reviews` | public | `{results,pagination}` | `images` always `[]` |
| GET `/recommendations/for-you` | JWT | `{data: RecommendationItem[]}` | never empty |
| POST `/recommendations/interactions` | JWT | 204 | includes `add_to_cart` `purchase`; unknown product **404** |
| GET/PUT `/me/taste-profile` | JWT | `{data: TasteProfile}` | missing → empty object |
| GET/POST `/alerts` | JWT | `{data:[]}` | restock in-stock **or inventory missing** → 409 |
| GET `/referrals/me` | JWT | `{code,pending,completed,reward}` | |
| POST `/referrals/claim` | JWT | 204 always | silent ignore |
| GET `/subscriptions` | JWT | `{data:[]}` unbounded | |
| POST `/subscriptions` | JWT | 201 | address ownership = **PR-040d**; second active = **409** (PR-057b) |
| PATCH `/subscriptions/:id` | JWT | 200 `{action}` | no `address_id` (PR-005c) |

---

## Proposed tasks (PR-050+)

Do **not** implement.

- **PR-050a** — Docs only: 5.7 closed · **be** · **P2** · **S**
- **PR-050b** — *merge with catalog-content PR-023* — search_performed on `GET /products?search=` + payload · **be** · **P1** · **M** · **DONE PR-070d**
- **PR-050c** — Persist analytics `sid`/`did` + BFF cookie passthrough · **both** · **P1** · **S**
- **PR-050d** — Server-side purchase (Confirm) + add_to_cart · **be** · **P1** · **M** · **DONE**
- **PR-050e** — LIMIT 100 on alerts, subscriptions, reviews mine/pending, wishlist · **be** · **P2** · **S**
- **PR-051a** — Hydrate public review images · **be** · **P1** · **M**
- **PR-051b** — Fix reviews.md 403-on-create · **be** · **P2** · **S**
- **PR-051c** — Review unlike · **be** · **P2** · **S**
- **PR-052a** — Blend taste profile into ForYou · **be** · **P1** · **M**
- **PR-053a** — Do not MarkNotified unless send succeeded · **be** · **P0** · **S**
- **PR-053b** — Enrich GET /alerts with title/slug/price · **be** · **P2** · **S**
- **PR-053c** — Restock create fail-closed on inventory miss · **be** · **P2** · **S**
- **PR-054a** — Referral claim `claimed` or 400 · **be** · **P2** · **S**
- **PR-055a** — Alert + renewal mail through dispatcher · **be** · **P1** · **M** · **DONE**
- **PR-056a** — Admin gift-card list + void (not PR-005b) · **be** · **P2** · **M**
- **PR-057a** — Do not advance renewal if email failed / mailer nil · **be** · **P1** · **S**
- **PR-057b** — Cap one active cellar-box · **be** · **P2** · **S** · **DONE**
- **PR-058a** — 404 unknown interaction product_id · **be** · **P2** · **S**
- **PR-058b** — Hydrate wishlist `options` · **be** · **P2** · **S**

Not re-proposed: PR-040d address ownership, PR-040h image URL scheme, PR-005a–c,
PR-010d, PH-043c.

---

## Out of scope / not bugs

- Loyalty earn/clawback → PR-003\*.
- Gift fulfill email / payment_url / subscription PATCH address → PR-005a–c.
- Cart line options → PR-010d.
- Meili storefront cutover → catalog lane / closed PH-030\*.
- Tokenized auto-charge → closed PH-043c.
- In-app notification inbox → product add.
- Admin review reply → not designed.

No application code changed.
