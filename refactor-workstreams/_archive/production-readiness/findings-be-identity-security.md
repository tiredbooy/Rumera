# Findings — `be-identity-security`

**Agent:** be-identity-security  
**Workstream:** `production-readiness-20260816`  
**Date:** 2026-08-16  
**Mode:** investigation only (no application code)

Whole-project backend identity + security. Task IDs start at **PR-040** so they do not collide with `be-money-ops` **PR-020\*** (refund/checkout). Do **not** re-propose PR-001…011. Closed PH / BE / Refactor-Docs stay closed unless a **new** live bug is shown.

---

## What I inspected

| Area | Paths |
|------|--------|
| Composer | `apps/backend/internal/routes/routes.go` |
| Auth | `internal/features/auth/` (handler, tokens, OTP, password reset), `pkg/token/jwt.go` |
| Users / admin | `internal/features/users/` (handler, service, repository, admin_guards, mapper) |
| RBAC | `internal/features/rbac/` + `internal/middlewares/permission.go` |
| Addresses | `internal/features/addresses/` (handler/service/repo all scoped) |
| Reviews IDOR 5.2 | `internal/features/reviews/service.go` `AddImage` |
| Middleware | `internal/middlewares/{auth,permission,ratelimit,security}.go`, `bootstrap/{newRouter,setupMiddlewares}.go` |
| Config / secrets | `apps/backend/configs/config.go`, `docker-compose.prod.yml`, `.env.prod.example` |
| Session / BFF | `apps/frontend/lib/auth/{auth.ts,auth.config.ts,session.ts}`, `app/api/store/[...path]/route.ts`, `app/api/admin/[...path]/route.ts` |
| Adjacent ownership | orders, wishlist, alerts, subscription, wallet, giftcard, referral, taste |
| Hint list | `docs/IMPROVEMENT-OPPORTUNITIES.md` §5.2, §5.21 |

---

## Re-verified historical rows (do not reopen)

| Hint | Current verdict | Evidence |
|------|-----------------|----------|
| **5.2** review-image IDOR | **Fixed.** `AddImage` loads the review and requires `review.UserID == caller`. Handler passes `httpx.UID`. Public `GET /reviews/:id` 404s non-approved. Residual is URL *scheme* (below), not ownership. | `reviews/service.go:262–282`, `reviews/handler.go:213–228`, `reviews/handler.go:75–90` |
| **5.21** JWT/RBAC untested | **Fixed (PH-013c).** Live-role rehydrate, ban/inactive, `RequirePermission`, refresh rotation tests exist. | `middlewares/auth_test.go`, `middlewares/permission_test.go`, `features/auth/tokens_test.go`, `pkg/token/jwt_test.go` |
| Login limiter fail-open | **Fixed.** Redis error falls through to in-memory limiter. OTP send/verify counters fail **closed**. | `middlewares/ratelimit.go:13–48`, `auth/otp.go:62–72`, `otp.go:127–133` |
| Refresh without Redis | **Fail-closed.** `issueTokens` / `rotateTokens` refuse an unrevocable refresh; login/register may return access-only. | `auth/tokens.go:47–65`, `tokens.go:119–121` |
| Register role mass-assign | **Fixed.** JSON may send `role`, mapper + `Service.Create` force `customer`. | `users/mapper.go:13`, `users/service.go:23–27` |
| Address IDOR | **Fixed.** Every SQL includes `user_id`. | `addresses/repository.go:103–104`, `:215`, `:281`, `:311` |
| Order IDOR | **Fixed.** Customer get/cancel uses `GetByIDAndUserID`; list forces `filter.UserID`. Checkout address uses `addresses.GetByID(id, userID)`. | `orders/handler.go:123–132`, `:143–154`; `orders/service.go:146`, `:478–479` |
| JWT alg confusion | **Fixed.** Keyfunc rejects non-HS256. Access vs refresh `token_type` + jti. | `pkg/token/jwt.go:129–134`, `:88–126` |
| Last-admin lockout | **Fixed (PH-021b).** | `users/repository.go:494–503`, `:605–612` |
| Live role after demotion | **Fixed.** Auth rehydrates `users.role` / `is_active` / `is_banned` / `sessions_invalidated_at`. | `middlewares/auth.go:33–76` |
| Prod JWT/CORS/SMS/metrics | **Fixed at boot.** `TRUSTED_PROXIES` is **not** in that list (new). | `configs/config.go:301–318` |
| Wallet free deposit / withdraw | Closed PH-041 (withdraw 410). Not reopened. | `wallet/handler.go:65–68` |
| Webhook HMAC fail-closed | Empty secret → 503; bad sig → 401. | `payments/webhook.go:41–54` |

`AddImages` (plural) still has **no** ownership check (`reviews/service.go:294–317`) but **no HTTP route** calls it. Dead code, not a live IDOR.

---

## Live findings

### 1. P0 — Login / global rate limits are spoofable in the intended prod topology

Gin default-trusts all proxies. `TRUSTED_PROXIES` is optional, **not** required in `Validate()` for production, and **not** set in `docker-compose.prod.yml`.

```26:34:apps/backend/internal/bootstrap/newRouter.go
	// Empty config leaves Gin's default; set TRUSTED_PROXIES to your ingress range
	// in production.
	if len(cfg.TrustedProxies) > 0 {
		if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
			logger.Fatal("invalid TRUSTED_PROXIES", zap.Error(err))
		}
	}
```

Prod nginx appends the real client but **preserves** a caller-supplied `X-Forwarded-For`:

```41:41:infra/nginx/nginx.prod.conf
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
```

With every hop trusted, `c.ClientIP()` becomes the leftmost (attacker-chosen) address. That is the key for:

- `LoginRateLimit` (login / register / forgot / OTP) — `middlewares/ratelimit.go:22`
- Global `RateLimit(100, 200)` — `bootstrap/setupMiddlewares.go:40`

Credential stuffing and OTP request floods then ignore the 10/min IP cap. OTP still has a per-phone cap (5/hour, fail-closed); login has **no** per-email lockout.

**PR-040a** — Require non-empty `TRUSTED_PROXIES` in production; wire compose to the docker/nginx CIDR; optionally reset XFF at nginx (`$remote_addr` only).

---

### 2. P0 — Access JWT is projected onto the client Auth.js session

BFF comments claim the access token never reaches the browser (`app/api/store/[...path]/route.ts:3–4`). The session callback contradicts that:

```26:33:apps/frontend/lib/auth/auth.config.ts
    session({ session, token }) {
      const role = (token.role as Role) ?? "customer";
      session.role = role;
      session.permissions = permissionsForRole(role);
      session.accessToken = token.accessToken;
```

`SessionGuard` calls `useSession()` (`features/auth/components/session-guard.tsx:23`). NextAuth therefore serves `GET /api/auth/session` **including the Go JWT** to every hydrated client. XSS (or any script on the origin) can call `/api/v1/admin/*` directly: prod CORS is the storefront origin (`docker-compose.prod.yml` `CORS_ALLOWED_ORIGINS`), and BE will accept a valid Bearer token.

Admin BFF allowlist is **not** a security boundary for a token that already lives in JS.

**PR-040b** (both) — Keep the access token only in the encrypted Auth.js JWT cookie (httpOnly). Strip `session.accessToken` from the session callback. Server `apiFetch` / BFF read the token from `auth()` on the server. Confirm with `fe-platform-quality`.

---

### 3. P1 — Staff `customers:write` is a split brain; it also mints money

HTTP: user writes are gated `customers:write` **OR** `customers:ban` (`routes.go:178–181`). Default staff seed **has** `customers:write` (`migrations/main/20260808140000_staff_role_and_capabilities.sql:47–58`).

Persistence: `liveAdminActor` requires `role == admin` (`users/repository.go:775–778`). Staff `POST/PATCH/DELETE /admin/users` therefore **403** after passing RBAC.

Same capability mounts wallet credit (`routes.go:183`, `wallet/routes.go:36–44`). `AdminCredit` does **not** call `liveAdminActor` — any staff with the seed package can `POST /admin/users/:userID/wallet/credit` and print ledger money.

`customers:ban` is OR’d onto the user write group but **nothing sets `is_banned` / `banned_at`**. Auth honors `IsBanned`; operators can only `is_active=false` (and only if they are admin).

**PR-040c** — Pick one model: (A) allow staff user mutations (drop `liveAdminActor` admin-only, keep last-admin + no self-lockout), or (B) require `admin` (or `roles:manage`) for role/status writes and give staff a non-money customer-edit grant. Split wallet credit to a dedicated capability (`customers:credit` / `wallet:credit`), not `customers:write`.

**PR-040e** — Either implement `POST /admin/users/:id/ban|unban` behind `customers:ban`, or drop the unused grant from catalogue + seed.

---

### 4. P1 — Subscription `address_id` is not owned (IDOR-to-attach)

Checkout **does** verify address ownership (`orders/service.go:146`). Box subscribe does not:

```22:32:apps/backend/internal/features/subscription/service.go
func (s *Service) Create(ctx context.Context, userID int64, req CreateSubscriptionReq) (*SubscriptionResponse, error) {
	sub, err := s.repo.Create(ctx, Subscription{
		UserID:        userID,
		Plan:          PlanCellarBox,
		Cadence:       req.Cadence,
		AddressID:     req.AddressID,
```

Insert is a bare FK (`20260615190000_create_subscriptions.sql`). A logged-in user can attach any existing `addresses.id`. Response echoes `address_id` only (existence oracle). Fulfillment/shipping would use the victim address. Not PR-005c (that is PATCH missing `address_id`); this is Create ownership.

**PR-040d** — `addresses.GetByID(id, userID)` before insert (same as orders).

---

### 5. P1 — CORS allow-list omits `Idempotency-Key`

```38:39:apps/backend/internal/middlewares/security.go
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Webhook-Signature")
```

Browser → Go (after a stolen token, or a future non-BFF client) will fail preflight on money POSTs. Same-origin BFF is unaffected, but BFF **already drops** the header (PR-003c). Two layers: FE must forward; BE must allow the header if the storefront origin is in CORS.

**PR-040f** — Add `Idempotency-Key` (and keep PR-003c on the BFF).

---

### 6. P2 — Auth endpoint leftovers

| Gap | Evidence | Risk |
|-----|----------|------|
| `POST /auth/refresh` and `/logout` unthrottled | `auth/routes.go:31–32` | Stolen/guessed refresh hammer + Redis rotate load. Tokens are JWTs so brute force is impractical; still a DoS/rotation-abuse surface. |
| Login timing oracle | `auth/handler.go:149–155` skips bcrypt when email missing or OTP-only (`PasswordHash == nil`) | Email enumeration despite identical JSON. |
| `GET /auth/password/validate?token=` | `auth/password_reset_handler.go:33–44` | Raw token in access logs / Referer. Reset itself is POST + hashed + prior tokens invalidated (`password_reset_repository.go:59–64`). |
| Unverified phone PATCH | `users/mapper.go:17–25`, unique index `20260615120000_users_phone_unique.sql` | Bind any unused MSISDN to the account; block that number from OTP signup. OTP login of that number then opens **this** account. |
| OTP plaintext in Redis | `auth/otp.go:79` | Redis dump = login codes. Acceptable if Redis is trusted; hash-at-rest would be tighter. |

**PR-040g** — Throttle refresh/logout/validate; dummy bcrypt on unknown email.  
**PR-040i** — Changing phone requires OTP to the new number (or admin-only).

Reset-token-in-query can fold into **040g** (switch validate to POST body).

---

### 7. P2 — Review `image_url` still untyped (5.2 residual)

Ownership is fixed. Bind tag is `validate:"required,max=2048"` only (`reviews/model.go:127`). A reviewer can attach `javascript:`, `data:`, or an attacker HTTPS tracker. Public PDP renders the URL.

**PR-040h** — Require `https` (or `/media/…`) and optionally the media host allow-list.

---

## What is *not* broken (so implementers do not “fix” it)

- Customer addresses, orders, wishlist (own `GetOrCreate` then item scoped by wishlist id), alerts (`Delete(userID, id)`), referral claim, taste, wallet self-reads: scoped to `httpx.UID`.
- Admin user create/update cannot be done by staff today (repo), so there is **no** live staff→admin privilege escalation via `POST /admin/users` + `role=admin`. The hole is “staff cannot operate customers” + “staff can credit wallets”.
- Vendor role is assignable and unused (customer-tier only). Not a hole.
- Metrics in production require a bearer token (`config.go:316–318`).
- Prod compose requires `JWT_SECRET`; default insecure secrets are **dev only**.
- Money idempotency `RequireKey: false` and store I/O fail-open (`newRouter.go:61–64`, `pkg/middleware/idempotency.go:83–138`) are **money-ops / PR-003c**, not re-proposed here.

---

## FE contract (for mid)

See `BOARD.md` mid post. Blocking questions:

1. `fe-platform-quality`: is `session.accessToken` on `useSession()` intentional? PR-040b assumes no.
2. `fe-admin-ops`: do you expect staff with `customers:write` to edit users (today 403) and/or credit wallets (today 201)?
3. `fe-commerce-account`: subscription create — do you send only the caller’s `address_id`? BE will start rejecting foreign ids.

---

## Proposed tasks (PR-040+)

| ID | Lane | Sev | Effort | Title |
|----|------|-----|--------|-------|
| **PR-040a** | be | **P0** | S | Production `TRUSTED_PROXIES` required + compose/nginx so auth rate limits cannot be XFF-spoofed |
| **PR-040b** | both | **P0** | M | Do not put the Go access JWT on the client Auth.js session; BFF/`apiFetch` only |
| **PR-040c** | be | P1 | M | Align staff `customers:write` with user mutations; split wallet credit off that grant |
| **PR-040d** | be | P1 | S | Subscription create: own `address_id` (same as checkout) |
| **PR-040e** | be | P2 | S | Implement ban/unban or remove dead `customers:ban` |
| **PR-040f** | be | P1 | S | CORS `Allow-Headers` include `Idempotency-Key` (pairs with PR-003c) |
| **PR-040g** | be | P2 | S | Throttle refresh/logout/validate; dummy bcrypt on login miss; POST-only reset validate |
| **PR-040h** | be | P2 | S | Review `image_url` https/`/media` allow-list (5.2 residual) |
| **PR-040i** | be | P2 | M | Phone change requires OTP to the new number |

**Implement order:** 040a → 040b → 040d → 040c → 040f → 040g → 040h → 040e → 040i.

---

## Suggested implement notes (no code in this workstream)

- **040a:** `Validate()` if `IsProduction() && len(TrustedProxies)==0` fail boot. Compose: `TRUSTED_PROXIES=172.16.0.0/12` (or the nginx service CIDR). Prefer nginx `proxy_set_header X-Forwarded-For $remote_addr`.
- **040b:** Delete `session.accessToken = …`. Any client hook that thought it had a Bearer token must go through `/api/store` or `/api/admin`. Add a test that `/api/auth/session` JSON has no `accessToken`.
- **040c:** Do not leave “HTTP allows, repo denies”. Document the chosen actor rule next to `liveAdminActor`.
- **040d:** 404 on foreign/missing address, same sentinel as checkout.

No application code changed.
