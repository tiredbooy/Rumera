# BFF Proxy & Auth / Session

The frontend never lets the browser talk to the Go API directly. Instead, the
browser calls **same-origin** Next.js route handlers that forward to the backend
**server-side**, attaching the caller's bearer token from the next-auth session.

This is a **Backend-for-Frontend (BFF)** pattern. It exists because:

- In production the Go API is bound to **loopback behind a reverse proxy** and is
  not reachable from the browser at all.
- `NEXT_PUBLIC_API_URL` is intentionally **not inlined** into the client bundle,
  so there is no backend URL for the browser to hit even if it wanted to.
- Routing through the Next.js server means the same client code works
  identically in **local dev, Docker, and prod** — no CORS, no exposed backend.
- The **access token never reaches the browser**; it lives in the encrypted
  Auth.js JWT cookie. Server BFF / `apiFetch` read it with `getToken`
  (`next-auth/jwt`). `GET /api/auth/session` and `useSession()` must not
  include it.

> Backend conventions referenced here (the `{ data }` / `{ error: { code, message } }`
> envelope, token TTLs, refresh rotation) live in
> `apps/backend/docs/conventions.md` and `apps/backend/docs/authentication.md`.

---

## The three proxies

All three live under `app/api/<tier>/[...path]/route.ts` and forward to
`${API_BASE}/<path>`, where `API_BASE` is `${API_URL}/api/v1` (see
`lib/api/client.ts`). The catch-all `[...path]` captures every segment after the
tier prefix; in Next.js 16 `ctx.params` is **async** and must be awaited:

```ts
type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
```

| Proxy      | File                                | Auth                                       | Allowlist style  | Forwards to                     |
| ---------- | ----------------------------------- | ------------------------------------------ | ---------------- | ------------------------------- |
| **public** | `app/api/public/[...path]/route.ts` | none                                       | exact full paths | unauthenticated auth forms      |
| **store**  | `app/api/store/[...path]/route.ts`  | session bearer + refresh                   | first segment    | per-user / checkout resources   |
| **admin**  | `app/api/admin/[...path]/route.ts`  | session bearer + refresh + **staff check** | first segment    | admin console + catalogue reads |

Every proxy:

- Limits methods to those it defines (`GET`/`POST` for public; plus
  `PATCH`/`PUT`/`DELETE` for store/admin).
- Returns `204` as an empty body, otherwise passes the backend's body and
  `Content-Type` through **unchanged** (the `{ data }` / `{ error }` envelope is
  preserved for the client to unwrap).
- On a thrown fetch (backend unreachable) returns `502 UPSTREAM_UNAVAILABLE`.
- On a path that fails the allowlist returns `403 FORBIDDEN_PATH`.

### Public proxy — `/api/public/*`

Unauthenticated, for the storefront's pre-login forms. It uses an **exact-path**
allowlist (the whole path after `/api/v1`, not just the first segment):

```ts
const ALLOW = new Set([
  "auth/register",
  "auth/password/forgot",
  "auth/password/reset",
  "auth/password/validate",
  "auth/otp/request",
  "categories/tree",
]);
```

It attaches **no token** and only forwards a body for non-`GET`/`HEAD` methods.
Consumers (all in `features/auth/components/`):

- `register-form.tsx` → `POST /api/public/auth/register`
- `forgot-password-form.tsx` → `POST /api/public/auth/password/forgot`
- `reset-password-form.tsx` → `POST /api/public/auth/password/reset`
- `phone-login-form.tsx` → `POST /api/public/auth/otp/request`

After a successful `register` or `otp/request`, the form then calls next-auth
`signIn(...)` to actually establish the session (see below) — the public proxy
only handles the credential-less pre-auth step.

### Store proxy — `/api/store/*`

Authenticated, for per-user resources. Allowlist is by **first segment**:

```ts
const ALLOW = new Set([
  "cart",
  "orders",
  "addresses",
  "coupons",
  "shipping",
  "wallet",
  "wishlist",
  "reviews",
  "alerts",
  "auth",
  "loyalty",
  "referrals",
  "gift-cards",
  "subscriptions",
  "recommendations",
  "me",
  "payments",
]);
```

`auth` is allowlisted only so the **self-service profile** routes
(`GET`/`PATCH /auth/me`) can be proxied; the backend still guards every
`/auth/*` route itself. `me` covers authenticated personalization routes.
`payments` covers customer start/status under `/payments/*` so a
`payment_url` (PR-005a) can be fetched through the BFF. It is **not** the
admin board: `/admin/payments` is first-segment `admin` on `/api/admin`,
never `/api/store`.

The proxy uses the Auth.js route wrapper, then reads the Go JWT from the
encrypted Auth.js cookie (`getToken`) and attaches
`Authorization: Bearer <accessToken>`. Every segment passes through the
shared traversal-safe target builder before the allowlist check. Consumed
via `storeRequest()` in `lib/api/store-client.ts`, which returns the
backend body verbatim and throws a typed `ApiClientError` from the
`{ error }` envelope.

#### Cart is login-gated (intended, PR-004c)

`cart` sits on this store allowlist, not on `/api/public`. With no session (or
a session error) the proxy returns `401` `{ error: { code: "SESSION_EXPIRED",
message: "sign in required" } }` and **does not** call Go. When a session
exists, Go still requires `Authorization: Bearer` and returns `401
UNAUTHORIZED` for missing/invalid tokens — see
`apps/backend/docs/api/cart.md` (**Auth-only**; guests are `401`; there is no
guest / anonymous cart).

There is no cookie or anonymous basket in the BFF, and no merge of guest lines
into the user cart on login. A guest `401` is expected. This is a **product
decision** (no guest/cookie cart unless product asks), not a hole to fill in
this program.

The founder add-to-cart **500 after a successful login** was PR-004a (`UNIQUE
NOT NULL` on `carts.user_id` so `GetOrCreate` can `ON CONFLICT (user_id)`),
not a missing guest cart. Storefront UX for guests is a login toast / wall
(`AddToCartButton`, `CartView`, `CartButton`); see
[storefront-commerce.md](../features/storefront-commerce.md) § Cart.

Both authenticated proxies also copy incoming **`Idempotency-Key`** onto the
upstream request when the client sent one (`pickIdempotencyKeyHeader` in
`lib/api/forward-headers.ts`). Loyalty redeem, wallet top-up, gift
purchase/redeem, and admin wallet credit depend on this so Go money
middleware can replay instead of double-spending. The BFF never invents a
key and must not log it.

The **store** proxy additionally copies incoming analytics **`sid` / `did`**
cookies upstream (`pickAnalyticsCookieHeader`) and passes matching
`Set-Cookie` lines back (`pickAnalyticsSetCookies`). Cookie names only —
no other cookies, and no invented IDs. Go capture middleware persists those
cookies (HttpOnly, SameSite=Lax, Secure in prod) so session conversion
joins can work. The allowlist is unchanged.

### Admin proxy — `/api/admin/*`

Authenticated **and staff-gated**. Two guards keep it from being an open proxy:

1. **Path** — first segment must be on the allowlist:
   ```ts
   const ALLOW = new Set([
     "admin",
     "products",
     "categories",
     "brands",
     "tags",
     "hero-slides",
   ]);
   ```
   The `admin` entry covers staff-namespaced endpoints; the others are read-only
   catalogue lookups the admin forms need.
2. **Role** — `session.user` must exist and a live `/auth/me` lookup must return
   `role=admin`; `customer` and `vendor` never receive admin access.

The backend repeats the live `admin` role check. Frontend permissions only
organize navigation inside that boundary; they are not backend authorization.

> **Path doubling is intentional.** The proxy forwards to
> `${API_BASE}/<segments>`, and `API_BASE` already ends in `/api/v1`. Backend
> endpoints that are themselves under the `admin/` namespace therefore look
> doubled from the client: creating a product calls
> `/api/admin/admin/products`, which forwards to `/api/v1/admin/products`. The
> admin image upload uses the same shape: `/api/admin/admin/products/:id/images`
> (see `features/admin/products/api/client.ts`). Standalone uploads use
> `/api/admin/admin/uploads` through `features/admin/uploads/client.ts`.

Unlike the store proxy, the admin proxy preserves **`multipart/form-data`**
bodies byte-for-byte (boundary intact) so product image uploads pass through:

```ts
if (isMultipart) {
  body = Buffer.from(await req.arrayBuffer());
  forwardHeaders["Content-Type"] = contentType; // keep the original boundary
} else {
  body = await req.text(); // JSON path
}
```

Consumed by resource-owned browser clients under `features/`, including
`uploadProductImage()` and `uploadImage()`. Each client owns its typed error;
validation-aware clients also carry the backend `fields` map.

---

## Persisted refresh rotation

Backend refresh tokens are single-use, so a consumer must not rotate unless it
can also return the replacement Auth.js cookie. React Server Components can read
cookies but cannot write them. Rumera therefore uses one rule:

- bare `auth()` calls in server rendering return `RefreshRequired` when the
  access token approaches expiry and never consume the refresh token;
- edge proxy reads expiry from `getToken()` (not the public session) and
  redirects protected page requests to
  `/api/auth/refresh-session?callbackUrl=…`, preserving the exact path;
- that route and both authenticated BFFs use the Auth.js route wrapper, where
  rotation can append `Set-Cookie` to the outgoing response;
- the store and admin proxies never read or exchange the raw refresh token
  themselves.

If rotation fails, the persisted session receives `RefreshAccessTokenError` and
the client session guard signs out. This avoids both refresh-token replay races
and successful requests whose replacement credential was discarded.
The backend also returns one identical replacement pair to concurrent retries
within its short replay window, so late `Set-Cookie` responses cannot overwrite a
successful rotation with an error session.

---

## next-auth v5 config

Auth uses the standard next-auth v5 **split-config** pattern so the edge proxy
can run on the **Edge runtime** (no Node-only code):

| File                                    | Runtime            | Contents                                                                                                                    |
| --------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `lib/auth/auth.config.ts`               | Edge + Node        | `pages`, `session` strategy, the `session()` callback (no access token), `getToken` helper, no providers                    |
| `lib/auth/auth.ts`                      | Node only          | Request-aware Credentials config, persisted rotation, and backend revocation on Auth.js sign-out                           |
| `lib/auth/access-token.ts`              | Edge + Node        | Expiry inspection used by protected-route edge proxy                                                                        |
| `lib/auth/session.ts`                   | Node (server-only) | server guards: `requireUser`, `requireStaff`, `requirePermission`                                                           |
| `lib/auth/types.ts`                     | —                  | module augmentation for the extra JWT/Session fields                                                                        |
| `app/api/auth/[...nextauth]/route.ts`   | Node               | re-exports `handlers` as `GET`/`POST` for `/api/auth/*`                                                                     |
| `app/api/auth/refresh-session/route.ts` | Node               | response-producing refresh redirect that persists the replacement cookie                                                    |

### Providers

Two **Credentials** providers in `lib/auth/auth.ts`, both POSTing to the Go
backend and returning a token pair:

- default `"credentials"` → `POST /auth/login` (email + password)
- `"otp"` → `POST /auth/otp/verify` (phone + code; the code was first requested
  via the public proxy)

The access token is a backend-signed JWT; `authorize()` **decodes (does not
verify)** its payload to read `role` and `exp` — it's trusted because it arrived
over the wire directly from our own API in response to a credential exchange.

`authorize` maps backend failures to Auth.js `CredentialsSignin` codes
(`RateLimited`, `Inactive`, `CredentialsSignin`, `AuthServiceError`) instead of
returning `null` for every error. Login/OTP forms show distinct Persian copy;
429 is never “wrong password”. See [auth.md](../features/auth.md).

### JWT callback & proactive refresh

```ts
async jwt({ token, user }) {
  if (user) { /* first sign-in: persist accessToken, refreshToken,
                 accessTokenExpires, role, user onto the token */ }
  // still valid (with a 60s safety margin)?  keep it.
  if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) {
    return token
  }
  if (!canPersistRotation) return { ...token, error: "RefreshRequired" }
  return rotate(token)   // route response can persist the replacement cookie
}
```

`rotate()` calls `POST /auth/refresh`, decodes the new access token for `role`
and `exp`, and clears any prior error. **If the refresh itself fails**, it does
not throw — it stamps the token with an error marker and returns it:

```ts
return { ...token, error: "RefreshAccessTokenError" };
```

The Auth.js `signOut` event receives the encrypted JWT before Auth.js clears its
cookie. It sends the server-only refresh token to `POST /auth/logout`, allowing
the backend to revoke the active rotation chain without exposing that token to
the browser session.

### Session shape

The `session()` callback in `auth.config.ts` projects **public** fields onto the
session. The Go access JWT stays on the encrypted Auth.js token (`token.accessToken`
in the `jwt` callback). BFF routes, `apiFetch`, `getLiveAccount` callers, and
the edge proxy read it with `getToken` from `next-auth/jwt` — never from
`session.accessToken`. Augmented by `lib/auth/types.ts`:

```ts
interface Session {
  role: Role; // from the token (backend access JWT), defaults "customer"
  permissions: Permission[]; // DERIVED from role via permissionsForRole()
  error?: "RefreshRequired" | "RefreshAccessTokenError";
  user: { id?: string } & DefaultSession["user"];
}
```

`permissions` is derived from `role` **here**, so every consumer (server guards,
middleware, client) reads the same resolved set. `role` rides on the JWT;
`permissions` is not stored on the token. The public session **never carries
the access token or the refresh token**. `GET /api/auth/session` and
`useSession()` therefore cannot leak the Go JWT to XSS.

> Roles → capabilities live in `lib/rbac/roles.ts`. The supported roles are
> `customer`, `vendor`, and `admin`; only `admin` is staff. These capabilities
> organize frontend UX and do not mirror effective backend permission rows.

---

## RefreshAccessTokenError handling & SessionGuard

There are two refresh outcomes:

| Context                   | Behavior                                                                 |
| ------------------------- | ------------------------------------------------------------------------ |
| Server-component `auth()` | returns `RefreshRequired` without consuming the refresh token            |
| Auth route/BFF wrapper    | rotates once, persists `Set-Cookie`, or stamps `RefreshAccessTokenError` |

When `rotate()` fails, the error is projected onto `session.error`. The
client-side **`SessionGuard`** (`features/auth/components/session-guard.tsx`) watches the
session via `useSession()` and reacts **only** to that terminal state:

```tsx
React.useEffect(() => {
  if (session?.error === "RefreshAccessTokenError" && !signingOut.current) {
    signingOut.current = true;
    void signOut({ callbackUrl: "/login" });
  }
}, [session?.error]);
```

It is mounted once under `SessionProvider` in `app/providers.tsx` and renders
nothing. The `signingOut` ref guards against a double sign-out under React Strict
Mode.

Crucially, `SessionGuard` signs the user out **only on terminal refresh
failure**. `RefreshRequired` is recoverable and is handled by the protected-route
redirect, never by signing out.

---

## The canonical `/login` path

The login page lives at `app/(auth)/login/page.tsx`. The `(auth)` **route group
adds no URL segment**, so the canonical path is **`/login`** (not `/auth/login`).
This single path must stay in lock-step across:

- `lib/auth/auth.config.ts` → `pages: { signIn: "/login" }`
- `proxy.ts` → redirects unauthenticated `/account` & `/admin` hits to `/login`
- `lib/auth/session.ts` → `requireUser` / `requireStaff` redirect to
  `/login?callbackUrl=…`
- `features/auth/components/session-guard.tsx` → `signOut({ callbackUrl: "/login" })`

The same `(group)` rule applies to `(account)` and `(storefront)`.

### Defense-in-depth access control

```
Edge proxy (coarse)            Server guards (live)             Backend authority
────────────────────────       ────────────────────             ─────────────────
proxy.ts                       lib/auth/session.ts               Go API
• /account, /admin only        • requireUser → /login           • re-read users row
• no session → /login          • requireStaff → live /auth/me   • reject inactive/ban
• expiring → refresh route     • requirePermission → UX gate    • RequireRole("admin")
• tags private pages noindex
```

The edge proxy runs on the Edge with the Node-free `authConfig` and only handles
session presence/expiry. The server guard checks live account state, and the
backend independently enforces the same live `admin` role. Frontend capability
checks are UX only.

---

## Request lifecycle — an authed admin upload

End-to-end for a standalone image upload (`uploadImage()` →
`/api/admin/admin/uploads`):

```
Browser (admin console)
  │  uploadImage() → XHR POST /api/admin/admin/uploads
  │  multipart { file, folder? }               (same origin, session cookie auto-sent)
  ▼
Next.js route handler — app/api/admin/[...path]/route.ts  (Node runtime)
  │  segments = ["admin","uploads"]
  │  ① ALLOW.has("admin")?                     ── no  → 403 FORBIDDEN_PATH
  │  ② Auth.js wrapper rotates if needed and persists Set-Cookie
  │  ③ live /auth/me returns role=admin?         ── no  → 403 FORBIDDEN
  │  ④ build Bearer header from getToken().accessToken
  │  fetch POST {API_BASE}/admin/uploads        (= /api/v1/admin/uploads)
  ▼
Go backend
  │  validate Bearer JWT + live account + RequireRole("admin")
  ▼
Go backend → 201 { data: { url, key, width, height } }
  ▼
Next.js handler → pass body + Content-Type and any rotated cookie
  ▼
Browser → uploadImage unwraps { data } → UploadedImage
```

The user is signed out only when route-level rotation cannot recover the session,
surfaced as `session.error === "RefreshAccessTokenError"` and handled by
`SessionGuard`.
