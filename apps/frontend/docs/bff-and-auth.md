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
  next-auth session cookie and is read server-side per request.

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
]);
```

`auth` is allowlisted only so the **self-service profile** routes
(`GET`/`PATCH /auth/me`) can be proxied; the backend still guards every
`/auth/*` route itself. The proxy reads the session with `auth()` and attaches
`Authorization: Bearer <session.accessToken>` if present. Consumed via
`storeRequest()` in `lib/api/store-client.ts`, which returns the backend body
verbatim and throws a typed `ApiClientError` from the `{ error }` envelope.

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
2. **Role** — `session.user` must exist **and** `isStaff(session.role)` must be
   true (`support` / `manager` / `admin`; see `lib/rbac/roles.ts`), else `403`.

The backend then enforces **per-permission RBAC** on top of this — the proxy is
deliberately a coarse gate, not the authority.

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

## 401 refresh-and-retry-once

Both authenticated proxies (store and admin) implement the **same** silent
recovery: if the upstream returns `401` (the access token expired mid-request),
they try **exactly one** refresh + retry, then give up.

```
send upstream with session.accessToken
        │
   401? ──no──► return response as-is
        │ yes
        ▼
read RAW next-auth JWT from the encrypted cookie  (getToken, server-only)
        │
   has refreshToken? ──no──► return the original 401
        │ yes
        ▼
POST {API_BASE}/auth/refresh { refresh_token }
        │
   got fresh access_token? ──no──► return the original 401
        │ yes
        ▼
re-send upstream with the fresh Bearer token  ──►  return that response
```

Key points:

- The **refresh token never reaches the browser**. The session callback projects
  only `accessToken` onto the session (see `lib/auth/auth.config.ts`), so the
  proxy can't get the refresh token from `auth()`. Instead it reads the **raw**
  encrypted JWT directly with `getToken()` from `next-auth/jwt`:

  ```ts
  const secureCookie = req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  return token?.refreshToken as string | undefined;
  ```

  `secureCookie` is derived from the request protocol so the right cookie name is
  read in dev (`authjs.session-token`) vs. prod (`__Secure-…`).

- The retry is **at most once**. If the refresh fails (token expired/revoked,
  backend down) the proxy returns the **original 401** untouched. It does **not**
  write a new session cookie — that 401 is the signal that flows to the client.

- This proxy-level refresh is a **safety net** for tokens that expire _during_ a
  request. The primary refresh path is in the JWT callback (`rotate()`), which
  refreshes proactively _before_ expiry (see next section).

---

## next-auth v5 config

Auth uses the standard next-auth v5 **split-config** pattern so the middleware
can run on the **Edge runtime** (no Node-only code):

| File                                  | Runtime            | Contents                                                                                                                   |
| ------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `lib/auth/auth.config.ts`             | Edge + Node        | `pages`, `session` strategy, the `session()` callback, no providers                                                        |
| `lib/auth/auth.ts`                    | Node only          | Credentials providers (fetch the backend), the `jwt()` callback + `rotate()`, exports `handlers`/`auth`/`signIn`/`signOut` |
| `lib/auth/session.ts`                 | Node (server-only) | server guards: `requireUser`, `requireStaff`, `requirePermission`                                                          |
| `lib/auth/types.ts`                   | —                  | module augmentation for the extra JWT/Session fields                                                                       |
| `app/api/auth/[...nextauth]/route.ts` | Node               | re-exports `handlers` as `GET`/`POST` for `/api/auth/*`                                                                    |

### Providers

Two **Credentials** providers in `lib/auth/auth.ts`, both POSTing to the Go
backend and returning a token pair:

- default `"credentials"` → `POST /auth/login` (email + password)
- `"otp"` → `POST /auth/otp/verify` (phone + code; the code was first requested
  via the public proxy)

The access token is a backend-signed JWT; `authorize()` **decodes (does not
verify)** its payload to read `role` and `exp` — it's trusted because it arrived
over the wire directly from our own API in response to a credential exchange.

### JWT callback & proactive refresh

```ts
async jwt({ token, user }) {
  if (user) { /* first sign-in: persist accessToken, refreshToken,
                 accessTokenExpires, role, user onto the token */ }
  // still valid (with a 60s safety margin)?  keep it.
  if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) {
    return token
  }
  return rotate(token)   // expired/expiring → refresh now
}
```

`rotate()` calls `POST /auth/refresh`, decodes the new access token for `role`
and `exp`, and clears any prior error. **If the refresh itself fails**, it does
not throw — it stamps the token with an error marker and returns it:

```ts
return { ...token, error: "RefreshAccessTokenError" };
```

### Session shape

The `session()` callback in `auth.config.ts` projects the token onto the session.
Augmented by `lib/auth/types.ts`:

```ts
interface Session {
  role: Role; // from the token (backend access JWT), defaults "customer"
  permissions: Permission[]; // DERIVED from role via permissionsForRole()
  accessToken?: string; // for the BFF proxies / apiFetch — NOT the refresh token
  error?: "RefreshAccessTokenError";
  user: { id?: string } & DefaultSession["user"];
}
```

`permissions` is derived from `role` **here**, so every consumer (server guards,
middleware, client) reads the same resolved set. `role` rides on the JWT;
`permissions` is not stored on the token. Notably the session **never carries
the refresh token** — only `accessToken`.

> Roles → permissions live in `lib/rbac/roles.ts`. Staff = `support`, `manager`,
> `admin`. The mapping is a frontend fallback that mirrors the backend tables
> until the API embeds permissions in the token.

---

## RefreshAccessTokenError handling & SessionGuard

There are **two layers** of refresh and they fail differently:

| Layer                   | When                               | On failure                                       |
| ----------------------- | ---------------------------------- | ------------------------------------------------ |
| JWT callback `rotate()` | proactively, before/at expiry      | stamps `token.error = "RefreshAccessTokenError"` |
| BFF proxy (store/admin) | reactively, on a `401` mid-request | returns the original `401`                       |

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
failure** — never on a healthy session, and never on a routine access-token
expiry (the silent refreshes above handle those transparently). A `401` from a
single BFF call does **not** trigger sign-out by itself; it surfaces to the
caller as a typed store or domain-client error. The session ends only when the
refresh token is genuinely dead.

---

## The canonical `/login` path

The login page lives at `app/(auth)/login/page.tsx`. The `(auth)` **route group
adds no URL segment**, so the canonical path is **`/login`** (not `/auth/login`).
This single path must stay in lock-step across:

- `lib/auth/auth.config.ts` → `pages: { signIn: "/login" }`
- `middleware.ts` → redirects unauthenticated `/account` & `/admin` hits to `/login`
- `lib/auth/session.ts` → `requireUser` / `requireStaff` redirect to
  `/login?callbackUrl=…`
- `features/auth/components/session-guard.tsx` → `signOut({ callbackUrl: "/login" })`

The same `(group)` rule applies to `(account)` and `(storefront)`.

### Defense-in-depth access control

```
Edge middleware (coarse)      Server guards (authoritative)     Backend RBAC
────────────────────────      ─────────────────────────────     ────────────
middleware.ts                 lib/auth/session.ts                Go API
• /account, /admin only       • requireUser   → /login           • per-permission
• no session → /login         • requireStaff  → /forbidden         enforcement on
• admin & !staff → /forbidden • requirePermission → /forbidden      every endpoint
• tags private pages noindex  • returns a narrowed session
```

The middleware runs on the Edge with the Node-free `authConfig` and only bounces
obvious cases early. The **authoritative** checks happen server-side in the route
layouts via the `lib/auth/session.ts` guards, and the backend enforces
per-permission RBAC regardless of what the frontend allows through.

---

## Request lifecycle — an authed admin upload

End-to-end for a standalone image upload (`uploadImage()` →
`/api/admin/admin/uploads`), including the silent-refresh branch:

```
Browser (admin console)
  │  uploadImage() → XHR POST /api/admin/admin/uploads
  │  multipart { file, folder? }               (same origin, session cookie auto-sent)
  ▼
Next.js route handler — app/api/admin/[...path]/route.ts  (Node runtime)
  │  segments = ["admin","uploads"]
  │  ① ALLOW.has("admin")?                     ── no  → 403 FORBIDDEN_PATH
  │  ② auth() → session; isStaff(session.role)? ── no  → 403 FORBIDDEN
  │  ③ build Bearer header from session.accessToken
  │  fetch POST {API_BASE}/admin/uploads        (= /api/v1/admin/uploads)
  ▼
Go backend
  │  validate Bearer JWT + per-permission RBAC
  │  ◄─ 401 (access token expired)?
  ▼
Next.js handler — refresh-and-retry-once
  │  getToken() → raw JWT → refreshToken        (refresh token stays server-side)
  │  POST {API_BASE}/auth/refresh { refresh_token }
  │     • fail → return the original 401 ─────────────────────┐
  │     • ok   → re-send POST /admin/uploads with fresh Bearer │
  ▼                                                            │
Go backend → 201 { data: { url, key, width, height } }         │
  ▼                                                            │
Next.js handler → pass body + Content-Type through (or 204)    │
  ▼                                                            ▼
Browser                                            Browser receives 401
  uploadImage unwraps { data }                     → no auto sign-out here; surfaces
  → UploadedImage                                    as UploadApiError(401). Sign-out
                                                     happens only later, if the JWT
                                                     callback's rotate() also fails and
                                                     stamps session.error, which
                                                     SessionGuard then acts on → /login
```

The dual-layer refresh means a user almost never sees an auth error: the JWT
callback refreshes proactively before expiry, and the BFF proxy catches the rare
mid-request expiry. The user is only signed out when the refresh token itself is
dead — surfaced as `session.error === "RefreshAccessTokenError"` and handled by
`SessionGuard`.
