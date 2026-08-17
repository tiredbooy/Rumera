# Findings — `ed-frontend`

**Workstream:** `event-driven-capacity-20260816`  
**Agent:** `ed-frontend`  
**Lane:** what the frontend must **not** change; HTTP contracts for eventual consistency  
**Date:** 2026-08-16  
**Method:** current source only. No application code.

Charter lock: the customer API stays HTTP + JSON. Next.js and the browser are
**not** Kafka clients. Money paths stay request/response. Events notify; they
are not the ledger.

---

## What already matches the charter

The storefront is already the shape this workstream wants.

| Layer | Path | Role |
| --- | --- | --- |
| Public RSC | `publicRequest()` → `${API}/api/v1/*` | Catalogue, PDP, recipes, journal, search |
| Auth RSC prefetch | `apiFetch()` + `HydrationBoundary` on `/account` | Overview cards, then client hooks |
| Browser | React Query → same-origin BFF | Cart, orders, wallet, admin tables |
| Public BFF | `/api/public/*` | Register, OTP request, password forgot/reset |
| Store BFF | `/api/store/*` | Session bearer; token never reaches the browser |
| Admin BFF | `/api/admin/*` | Staff + allowlist; revalidates Next tags after writes |

Evidence: `apps/frontend/docs/platform/architecture.md`,
`docs/platform/data-fetching.md`, `docs/platform/bff-and-auth.md`.

Hard facts from this pass:

- **Zero** `EventSource`, SSE, WebSocket, or Kafka usage under `apps/frontend`.
- Search is `GET /products?search=` (Postgres ILIKE). Docs already say: do not
  call Meili from the browser (`apps/frontend/docs/features/search.md`).
- Default QueryClient: `staleTime: 60_000`, `refetchOnWindowFocus: false`.
- Admin catalogue writes already bust the storefront via
  `revalidateAfterAdminMutation` → `lib/cache-tags.ts` (same Next process).
- Gift-card / wallet pending states already tell the truth (“only after
  gateway”) and refresh on an explicit button — they do not invent live sockets.
- Order confirmation already hedges loyalty: «افزوده شده یا به‌زودی ثبت
  می‌شود» (`order-confirmation-view.tsx`). That is the right voice for async
  side effects.

**Do not** “event-drive the frontend.” Do not add a Kafka JS client, a
storefront WebSocket, or a general-purpose live bus.

---

## Eventual consistency that already exists (FE must stay honest)

These are live, not hypothetical. When `NOTIFICATIONS_MODE=async`, HTTP 2xx/202
means **queued**, not delivered (`apps/backend/docs/architecture/notifications-kafka.md`).

| Shopper action | HTTP result today | Side effect | FE copy today |
| --- | --- | --- | --- |
| `POST /auth/otp/request` | **202 empty** (`otp.go`) | `DispatchOTP` → SMS now or outbox | «کد تأیید به این شماره پیامک می‌شود» / «کد ۶ رقمی پیامک‌شده» — sounds sent |
| `POST /auth/password/forgot` | **always 202** (enumeration-safe) | `notification.password_reset.v1` | «لینک … ارسال می‌شود» — close, still present-tense |
| Paid order | 200 on create/confirm | `ReceiptSender` → `DispatchOrderConfirmed` **off the request path** | Mail card: «از سفارش‌های من دنبال کنید» — **no receipt-email sentence** |
| Paid gift purchase | 200 + later fulfill | `DispatchGiftPurchased` email | Pending UI talks about **code after pay**, not recipient email delay |
| Restock / price alert | 200 on subscribe | Cron → `notification.alert.v1` | Toast: «هنگام موجود شدن به شما اطلاع می‌دهیم» — already eventual, keep |
| Loyalty after pay | points after settle (PH-040c) | retry / consumer (ED-030) | Confirmation already says «به‌زودی» — keep; do not invent a live balance |

Account notification switches (`order_sms` = «اطلاع لحظه‌ای تحویل») are
**disabled coming-soon stubs**. Leave them off. Do not promise instant SMS if
that tab is ever wired.

Search / recs:

- Discovery is still the DB. No search-index lag on the storefront today.
- Public recs use `force-cache` + 30 min (`features/recommendations/api.ts`).
  If ED-030 rebuilds recs asynchronously, that TTL is the shopper contract —
  not a browser event stream.

---

## Polling / ETag — what is real vs noise

### Origin already speaks ETag; Next does not listen

Go `response.CachedJSON` / `RevalidateJSON` (`pkg/response/cache.go`) emit a
strong ETag and 304 on `If-None-Match` for:

- Product detail (id + slug)
- Category tree
- Recipe detail (`no-cache` + ETag so view counts still fire)

Frontend:

- `publicRequest` always `response.json()`. A 304 (empty / non-JSON) would
  throw `ApiError`.
- No `If-None-Match` is ever sent (`apps/frontend` has **zero** ETag matches).
- Public / store / admin BFF responses copy status + `Content-Type` only.
  `ETag` / `Cache-Control` are dropped (`storefrontResponse`, public `handle`).
- Freshness for shoppers is **Next Data Cache** (30s product detail, 60s list,
  1h categories/recipes/journal) plus admin `revalidateTag`.

So ETag is a **Next → Go** capacity contract, not a browser feature. Implement
conditional GET on the RSC/`publicRequest` hop if ED-020 or k6 shows origin
waste on catalogue GETs. Do **not** teach the browser to cache money/order
JSON via ETag.

### Polling that would be real

| Surface | Verdict |
| --- | --- |
| OTP / reset email “did it arrive?” | **No poll.** No delivery-status API. Copy only. |
| Loyalty number on confirmation | **No poll today** — the page does not show a points figure. |
| Gift code after gateway | **Already** a manual «بروزرسانی کارت‌ها» refresh. Optional short
  `refetchInterval` only if product asks; not required for ED. |
| Admin `/admin/orders` | RQ, no `refetchInterval`, refetch on mutation + error retry. Fine for
  current volume. |
| Admin SSE / WebSocket | **Not justified.** No backend stream, no ops SLA, no missed-order
  metric. A 15–30s HTTP poll is the first upgrade if ops ever needs it. |

### Cache bust from a Kafka consumer (if ED-020 lands)

Admin BFF `revalidateAfterAdminMutation` only runs in the **Next process that
handled the write**. A catalogue/search consumer in Go cannot expire Next tags
unless something HTTP-calls Next.

If ED-020 invalidates product/index off-request, the FE contract is a
**loopback / secret `POST /api/revalidate`** that applies the existing
`getAdminRevalidationPlan` / `applyAdminRevalidationPlan` — not EventSource
and not Kafka in the browser.

Until that consumer exists, do not build the hook.

---

## What FE must not change (explicit non-goals)

- Do not put Kafka, Redpanda, or consumer groups in `apps/frontend`.
- Do not add storefront WebSockets or a global SSE provider.
- Do not replace checkout, wallet debit, refund, or reserve with a client saga.
- Do not cut search over to Meili from the browser; keep `listProducts({ search })`.
- Do not treat 202/queued notify failures as checkout or login HTTP errors.
- Do not invent `payment_url`, guest cart, or instant loyalty earn (already
  settled in PR-030 / PH-040).
- Do not reopen PH/PR unless a live FE bug appears from ED backend work.

---

## Proposed tasks — `ED-040+`

Few, claimable, lettered. Docs + small FE only. No Kafka.

### ED-040 — FE stays HTTP: transport contract (docs)

**Effort:** S · **Docs only**

Write the lock into the FE/Obsidian tracks (not a new architecture):

- Customer + admin UIs talk **only** RSC + BFF HTTP/JSON.
- Freshness model table: Next tags/TTL, TanStack `staleTime`, explicit refresh
  buttons, 202 = queued.
- Forbidden: Kafka in the browser, EventSource on the storefront, WS-everything.
- Search stays `GET /products?search=` until a **backend** Meili cutover; even
  then the browser still hits Next/Go HTTP.

**Files:** `apps/frontend/docs/platform/architecture.md`,
`docs/platform/data-fetching.md`, `obsidian/04 Frontend/Frontend Architecture.md`,
`obsidian/11 Decisions/` (short ADR: “FE is not an event client”).

**Acceptance:** a new engineer cannot “add live Kafka to the PDP” without
hitting this page. No app runtime change.

### ED-041 — Queued side-effect UX (“email/SMS shortly”)

**Effort:** S · **FE copy + tests**

HTTP 202/2xx after enqueue is success of **accept**, not **deliver**. Align
copy and keep errors honest.

| Surface | Change |
| --- | --- |
| OTP request (`phone-login-form.tsx`) | After 202: «کد به‌زودی پیامک می‌شود» — not “already sent”. Keep 429/5xx as they are. Empty 202 body must stay non-throwing (`authPublicRequest` already is). |
| Forgot password | Keep enumeration-safe success. Say the link **arrives shortly if the account exists** (outbox delay). |
| Order confirmation Mail card | Paid-like: «رسید به‌زودی به ایمیل حساب می‌رسد؛ اگر نرسید از سفارش‌های من پیگیری کنید.» Unpaid: do **not** promise a receipt (BE does not send on pending/failed — `receipt_test.go`). |
| Gift purchase (post-pay) | One line: recipient/self email is queued after settle; code still only after pay + refresh. |
| Alert toast | Keep eventual wording. Do not add “sent”. |
| Settings notify tab | Leave coming-soon. If any string is touched, drop «لحظه‌ای». |

**Do not** add a notification-status endpoint or poller.

**Acceptance:** RTL copy tests for OTP success, forgot-password success, and
confirmation paid vs pending. Checkout still succeeds if mailer/worker is down.

### ED-042 — Conditional GET on the Next→Go hop (only)

**Effort:** M · **FE transport** · implement when ED-020 or k6 shows origin waste;
the 304-safety part can ship first because it is a landmine.

1. `publicRequest` (and `apiFetch` if used on CachedJSON routes): send
   `If-None-Match` when Next has a stored validator; on **304** reuse the
   cached JSON; never `response.json()` a 304.
2. Optional: public BFF may forward `ETag` / `If-None-Match` for
   `categories/tree` only if that path is fetched through the BFF. RSC catalogue
   talks to Go directly — BFF is not required for PDP.
3. Store/admin BFF: **do not** start caching order/wallet/payment bodies.
4. **Gated on ED-020:** secret `POST /api/revalidate` (or equivalent) that
   calls `applyAdminRevalidationPlan` so a Go consumer can expire Next tags.
   Loopback + shared secret. No browser caller.

**Acceptance:** unit tests — 200 stores ETag; matching `If-None-Match` → 304
handled as hit; payload change → 200 + new ETag. k6 catalogue GET (when the
suite claims it) should show smaller origin bodies on repeat PDP/tree.

**Non-goal:** browser `Cache-Control` for authenticated JSON.

### ED-043 — Admin orders stay pull-HTTP; SSE deferred

**Effort:** S · **docs now; code only if ops claims it**

SSE for `/admin/orders` is **not justified** today:

- No `text/event-stream` anywhere in the repo.
- `useAdminOrders` already refetches after status/refund and on error retry.
- Staff volume does not have a written “see new order in <N s” SLA.

**Now:** document in admin-orders FE docs + this charter: first upgrade is
`refetchInterval` 15–30s (visible-tab only) + optional ETag on
`GET /admin/orders` through the admin BFF. Still request/response.

**Later (do not claim until all are true):**

- Ops writes an SLA (e.g. pack-desk must see `paid` within 5s without refresh).
- Backend owns a narrow `GET /admin/orders/stream` (or equivalent) with authz.
- Storefront still has **no** EventSource.

**Acceptance (docs claim):** findings + FE admin orders doc state the deferral
and the HTTP-poll fallback. No SSE code in this workstream unless the founder
re-opens this ID with the SLA attached.

---

## Suggested claim order

1. **ED-040** (docs lock) — unblocks every other lane from “helping” the FE.
2. **ED-041** (copy) — real shopper lie once async notify is the prod default.
3. **ED-042** after ED-020/k6 evidence, except 304-safety if someone starts
   sending `If-None-Match`.
4. **ED-043** stays documentation unless ops asks.

---

## Answers to other ED lanes

- **ed-platform / ed-money:** do not add delivery-status or outbox IDs to
  checkout JSON for the browser. 202/200 + existing order/payment resources
  are enough.
- **ed-catalog:** keep `GET /products` and `GET /products/slug/:slug` as the
  shopper read model. If an index lags, `/search` must not say “no products”
  when the PDP exists — that is a copy/empty-state job on cutover, not SSE.
- **ed-engagement:** recs/loyalty/alerts stay pull. Confirmation already hedges
  points. Do not stream analytics to the storefront.
- **k6-suite:** useful FE-adjacent cases are repeat PDP/category-tree GET
  (ETag/304) and checkout that succeeds when notification-worker is down.
  Do not add a browser-Kafka scenario.

---

## Out of scope (on purpose)

- Redesign, new live-ops dashboard, PWA push, third-party chat.
- Changing BFF allowlists except a future secret revalidate route.
- Reopening PH-011 idempotency or PR confirmation-status work.
