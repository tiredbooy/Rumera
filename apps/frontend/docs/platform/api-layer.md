# Frontend API / Data-Access Layer

Frontend access to the Go backend is split between shared transport under
`lib/api/` and resource-owned APIs under `features/`. This doc covers the
**client/data layer**: the request helpers, the typed CRUD
functions, how the various response envelopes are unwrapped, how errors (and 422
field errors) propagate, and a recipe for adding a new endpoint.

> The **transport** (how the browser reaches the backend through same-origin
> route handlers, the staff/refresh logic, the allowlists) is documented in
> `apps/frontend/docs/bff-and-auth.md`. The backend response/error **envelope**
> contract lives in `apps/backend/docs/conventions.md`. This doc assumes both and
> does not repeat them.

---

## The big picture

There are **four** request entry points, split by _where the code runs_ and
_which backend tier_ it targets.

```
                         browser (client components)            server (RSC / route handlers)
                         ─────────────────────────────          ─────────────────────────────
  PUBLIC (no auth)       (auth forms POST to /api/public)        feature domain API ── publicRequest()
                                                                               ↳ lib/api/public.ts
  CUSTOMER (session)     storeRequest()  ── lib/api/store-client.ts           apiFetch()  ── lib/api/client.ts
                          ↳ via /api/store/* BFF proxy            ↳ explicit token or bearer from session
  STAFF (session+staff)  resource client ── features/<owner>/...             apiFetch()  (admin-tier paths)
                           ↳ via /api/admin/* BFF proxy                       ↳ server actions/API modules
```

| Helper                      | File                                                     | Runs in                                  | Reaches backend via             | Unwraps                                      |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------- | ------------------------------- | -------------------------------------------- |
| `apiFetch`                  | `lib/api/client.ts`                                      | **server only** (`import "server-only"`) | direct `fetch` to `${API_BASE}` | `{ data }` → `T`                             |
| `storeRequest`              | `lib/api/store-client.ts`                                | browser                                  | `/api/store/*` BFF proxy        | **nothing** — returns body verbatim          |
| Resource-owned admin client | `features/<owner>/.../client.ts`                         | browser                                  | `/api/admin/*` BFF proxy        | endpoint-specific, usually `{ data }` → `T`  |
| `publicRequest`             | `lib/api/public.ts`, called by feature-owned server APIs | **server only**                          | direct `fetch` to `${API_BASE}` | `{ data }` → `T`, otherwise returns the body |

`API_BASE` is `${API_URL}/api/v1` (resolved in `lib/api/base.ts` from
`API_URL` → `NEXT_PUBLIC_API_URL` → `http://localhost:8080`).

---

## Response envelopes — three shapes, three unwrap rules

The backend returns one of three JSON shapes (see
`apps/backend/docs/conventions.md`). **There is no single unwrap path** — the
right one depends on the endpoint, and the helper you call reflects that choice.

| Envelope                                          | Example endpoint                                                | How callers unwrap                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `{ data: T }` — single resource                   | `GET /products/:id`, `POST /admin/categories`                   | Domain clients and server API modules unwrap `body?.data ?? body`. `storeRequest` callers do `.then(b => b.data)`. |
| `{ results: T[], pagination }` — list             | `GET /products`, `GET /admin/users`, `GET /wallet/transactions` | typed as `Paginated<T>` (`lib/api/types.ts`); callers keep the **whole** envelope.                                 |
| `{ error: { code, message, fields? } }` — failure | any 4xx/5xx                                                     | parsed into a typed error class (see _Error handling_).                                                            |

> `Paginated<T>` (in `lib/api/types.ts`):
>
> ```ts
> type Paginated<T> = { results: T[]; pagination: Pagination };
> type Pagination = {
>   page;
>   limit;
>   total_items;
>   total_pages;
>   has_next;
>   has_prev;
> };
> ```

### Why `storeRequest` does NOT unwrap

Domain clients and server API modules collapse `{ data }` → `T` where their
endpoint contract requires it. `storeRequest` deliberately returns the **raw body** because the store endpoints are a mix of
`{ data }` _and_ `{ results, pagination }`, and the caller knows which it is:

```ts
// single resource → caller picks .data
storeRequest<{ data: Cart }>("cart").then((b) => b.data);

// paginated list → caller keeps the envelope
storeRequest<Paginated<OrderListItem>>(`orders${buildQuery(params)}`);
```

This is why the hooks in `lib/api/hooks.ts` are littered with `.then(b => b.data)`
— it is the explicit unwrap step, not boilerplate.

---

## Resource-owned admin clients

There is no global admin browser client. Each resource owns the smallest client
or server API module needed by its UI, so adding one endpoint cannot expand a
catch-all dependency. Current examples include:

| Resource                        | Owner                                                  | Browser transport                      |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| **Products and product images** | `features/admin/products/`                             | product client plus server actions     |
| **Categories and brands**       | `features/admin/categories/`, `features/admin/brands/` | resource clients for interactive forms |
| **Recipes**                     | `features/recipes/api/`                                | recipe client                          |
| **Customers**                   | `features/customers/`                                  | customer client                        |
| **Site settings**               | `features/settings/api/`                               | settings client                        |
| **Hero slides**                 | `features/hero-slides/api/`                            | hero-slide client                      |
| **Standalone uploads**          | `features/admin/uploads/`                              | upload client                          |

The path passed by a resource client is still the backend path after `/api/v1`.
Admin-namespaced calls therefore retain the literal `admin/` segment and hit a
doubled browser path such as `/api/admin/admin/products`. Public catalogue reads
needed by forms skip that segment.

### Request typing pattern

Every mutation takes a resource-owned typed `*Input` that **mirrors the Go request struct**.
Create inputs are explicit; update inputs are `Partial<>` of create (so PATCH
sends only changed keys). Examples:

```ts
type CreateProductInput  = { title: string; category_id?: number | null; variants?: CreateVariantInput[]; ... }
type UpdateProductInput  = Partial<Omit<CreateProductInput, "variants">> & { is_active?: boolean }

type CreateCategoryInput = { name: string; parent_id?: number | null; slug?: string | null; ... }
type UpdateCategoryInput = Partial<CreateCategoryInput>

type UpdateSiteSettingsInput = Partial<Omit<SiteSettings, "updatedAt">>  // PUT replaces a group WHOLESALE
```

List params (`ListRecipesParams`, `ListUsersParams`) are serialized with
`URLSearchParams`, skipping `undefined | null | ""`. (Server-side fetchers use
the shared `buildQuery` helper in `lib/api/qs.ts` instead — same skip rule, plus
array-repeat support: `ids=1&ids=2`.)

### Image uploads

Image clients use raw `XMLHttpRequest` so they can report browser-to-Next upload
progress through `xhr.upload.onprogress`; the admin proxy preserves the
multipart boundary verbatim. Product images are owned by
`features/admin/products/`. Standalone hero/recipe/journal images are owned by
`features/admin/uploads/`: `uploadImage(file, { folder, signal }, onProgress)`
posts `file` and optional `folder` fields to `/api/admin/admin/uploads`, resolves
the exact `{ data: { url, key, width, height } }` contract, and throws a typed
`UploadApiError` from `{ error: { code, message, fields? } }`.

---

## `storeRequest` — the customer client core

`lib/api/store-client.ts`. Thin, returns the body **verbatim**, throws
`ApiClientError(status, code, message, fields?)` on `!res.ok`. Field maps are
forwarded when the backend sends `error.fields` (forms still zod-validate first;
server 422 can still surface via the helper below).

### User-facing errors (PH-012d)

**Never** replace a useful API `code` / `message` with only a static
“something went wrong” / generic Persian when the envelope already explains
the failure.

| Helper | File | Use |
|--------|------|-----|
| `describeApiError(err, { fallback })` | `lib/api/user-facing-error.ts` | `{ title, description?, fieldErrors?, code? }` |
| `apiErrorToast(err, fallback)` | same | sonner `toast.error(title, { description })` |
| `apiErrorMessage(err, fallback)` | same | single-line toast / inline alert |

Rules:

1. High-traffic **codes** map to clear Persian (`OUT_OF_STOCK`, coupon family,
   `INSUFFICIENT_FUNDS` / `INSUFFICIENT_POINTS`, `GIFT_CARD_INVALID`,
   auth/session, `FORBIDDEN` / `INSUFFICIENT_PERMISSIONS`, …).
2. Prefer mapped title; attach non-generic server detail when helpful.
3. Persian server `message` wins when the code is unknown.
4. Generic fallback **only** when code is unmapped **and** message empty/generic.
5. Wire money paths: checkout place-order + coupon, cart mutations, gift redeem,
   loyalty redeem, admin wallet credit, admin account actions, recipe bulk-add.

Backend catalogue: `apps/backend/docs/architecture/error-messages.md`.

Almost nothing calls `storeRequest` directly — it is wrapped by the React Query
hooks:

- **`lib/api/hooks.ts`** — cart (incl. `bulk`), alerts, loyalty, subscriptions,
  gift cards, referrals, taste profile, addresses (list/create), shipping,
  coupons, orders, wishlist (with optimistic heart-flip), personalised recs.
- **`lib/api/account-hooks.ts`** — wallet + ledger, address mutate/delete/
  set-default, the customer's own reviews, profile (`GET`/`PATCH /auth/me`).

Hooks pull cache keys from `lib/api/query-keys.ts` (`queryKeys`) so invalidation
stays consistent. Cart mutations seed the cache with the returned `Cart` to
avoid a refetch round-trip; wishlist add/remove are optimistic with rollback.

> Several `account-hooks.ts` query fns carry `// TODO(api):` comments — the
> _call shape_ is built but the exact backend route/response is unconfirmed
> (`reviews/mine`, `reviews/pending`, `addresses/:id/default`,
> `recommendations`). Treat those as not-yet-verified.

> The remaining `lib/api/admin-hooks.ts` product/image hooks delegate to the
> product-owned actions under `features/admin/products/`. New admin data access
> belongs to its resource owner rather than this shared hook module.

---

## `apiFetch` — server-side API requests

`lib/api/client.ts`, `import "server-only"`. `apiFetch<T>(path, opts?)` accepts
standard `RequestInit` options plus an optional `{ token?: string }`. Use it from
Server Components, route handlers, server actions, and server API modules:

```ts
import { apiFetch } from "@/lib/api/client";

const order = await apiFetch<Order>(`/orders/${id}`);
const updatedOrder = await apiFetch<Order>(`/orders/${id}`, {
  method: "PATCH",
  body: JSON.stringify(input),
});
```

`apiFetch` sends `${API_BASE}${path}` directly. An explicit `opts.token` takes
precedence; otherwise it calls `auth()` and uses `session.accessToken` when one
is available. It unwraps `{ data } ?? body`, throws
**`ApiError(status, code, message)`** on `!res.ok`, and defaults to
`cache: "no-store"` unless the caller opts into caching.

---

## Public server-side APIs (`publicRequest` + feature owners)

Unauthenticated server reads are owned by their feature domains and share
`publicRequest()` from `lib/api/public.ts`. That transport calls `${API_BASE}`
directly, unwraps `{ data }` when present, and throws `ApiError(status, code,
message)` for non-2xx responses. Native fetch failures also propagate.

Primary storefront reads preserve the difference between a successful empty
response and an upstream failure. Lists, trees, featured/related collections,
and slug-discovery reads return genuine empty pages/arrays but throw on network,
5xx, and other failed responses. Direct product, recipe, and journal detail
reads map only a typed `ApiError` 404 to `null`; every other failure throws to
the nearest route boundary. Product/category lookups that resolve through a
successful list return `null` only when no exact slug matches.

Optional PDP enrichments are deliberately different: recommendation helpers and
the product review list/summary catch failures and return empty/null fallbacks so
the primary product detail can still render. Their fallback does not make the
product detail read itself error-safe.

Caching remains domain-specific: product lists are `no-store` because they carry
live availability; cached product details, categories, recipes, and journal reads
use `3600s`; recommendations use `1800s`; product reviews use `600s`.

| Reads                                                                             | Feature owner                             | Error semantics                                         |
| --------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `listProducts`, `getProductById`, `getProductBySlug`, `allProductSlugs`           | `features/catalog/products/api/public.ts` | primary; exact slug matching, typed 404 detail null     |
| `listCategories`, `getCategoryBySlug`, `getCategoryTree`, `getFeaturedCategories` | `features/catalog/categories/api.ts`      | primary; successful exact miss null, failed list throws |
| recipe lists/detail/featured/related/static slugs                                 | `features/recipes/api/server.ts`          | primary; typed 404 detail null                          |
| journal pages/detail/categories/related/static slugs                              | `features/journal/api/server.ts`          | primary; typed 404 detail null                          |
| product review list/summary                                                       | `features/reviews/api.ts`                 | optional PDP enrichment; error-safe fallback            |
| trending/similar/frequently-bought-together                                       | `features/recommendations/api.ts`         | optional enrichment; error-safe fallback                |

Only each dynamic product/category/recipe/journal route's
`generateStaticParams()` slug discovery is fail-soft: it logs sanitized context
and returns `[]`. This protects parameter enumeration, not the complete build.
Static storefront pages/layouts and the sitemap still require live API data or a
populated cache, so `next build` is not guaranteed with every API offline.

> `lib/products.ts` is **not** a fetcher — it is static sample/display data plus
> the `faNum()` / `formatPrice()` helpers. `endpoints.ts` maps backend path
> strings; `query-keys.ts` holds React Query key factories.

---

## Error handling

Shared transports and resource clients expose typed errors carrying
`(status, code, message)` parsed from the `{ error: { code, message } }`
envelope:

| Class                                                                              | Thrown by                                                                  | Extra                                                                  |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `ApiError`                                                                         | `apiFetch` (`lib/api/client.ts`) and `publicRequest` (`lib/api/public.ts`) | —                                                                      |
| `ApiClientError`                                                                   | `storeRequest` (`lib/api/store-client.ts`)                                 | —                                                                      |
| Resource errors such as `CategoryApiError`, `RecipeApiError`, and `UploadApiError` | Matching resource-owned browser client                                     | validation-aware clients carry **`fields?: Record<string, string[]>`** |

`publicRequest` throws `ApiError` on non-2xx responses. Primary public domain APIs
propagate failures except for typed detail 404s; only explicitly optional
recommendation/review enrichments use broad empty/null fallbacks.

### 422 field errors → react-hook-form

Validation-aware resource errors carry `fields`. The backend returns failures as
`{ error: { code, message, fields: { <field>: ["msg", ...] } } }`. Admin forms
catch the error and map each field onto the form via `setError`. The pattern
(identical across `category-form.tsx`, `product-form.tsx`, `brand-form.tsx`,
`hero-form.tsx`, `user-edit-form.tsx`, `settings-form.tsx`, `recipe-form.tsx`):

```ts
function applyServerErrors(e: unknown) {
  if (e instanceof CategoryApiError) {
    if (e.fields) {
      for (const [key, msgs] of Object.entries(e.fields)) {
        setError(key as keyof FormValues, { message: msgs[0] }); // first message wins
      }
    }
    toast.error(e.message); // also surface the top-level message
  } else {
    toast.error("خطای غیرمنتظره رخ داد"); // unknown → generic toast
  }
}
```

So a 422 lights up the offending inputs inline (react-hook-form) **and** raises a
sonner toast; any other error raises a generic toast. For this to line up, the
field **keys in `fields` must match the form field names** — keep your `*Input`
field names identical to the backend JSON keys.

---

## How to add a new endpoint

Worked example: add admin CRUD for a hypothetical `collections` resource.

**1. Add the type(s)** in `features/collections/types.ts`, mirroring the Go
response/request structs exactly — same field names:

```ts
export type Collection = {
  id: number;
  title: string;
  slug: string;
  is_active: boolean;
};
export type CreateCollectionInput = { title: string; slug?: string | null };
export type UpdateCollectionInput = Partial<CreateCollectionInput> & {
  is_active?: boolean;
};
```

**2. Add a collection-owned client** in `features/collections/api/client.ts`.
Keep its request helper private to that resource and remember the `admin/`
segment for write paths:

```ts
export function listCollections() {
  return collectionRequest<Paginated<Collection>>("admin/collections");
}
export function createCollection(input: CreateCollectionInput) {
  return collectionRequest<Collection>("admin/collections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function updateCollection(id: number, input: UpdateCollectionInput) {
  return collectionRequest<Collection>(`admin/collections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
export function deleteCollection(id: number) {
  return collectionRequest<void>(`admin/collections/${id}`, {
    method: "DELETE",
  });
}
```

**3. Allowlist the first path segment** in the proxy. The admin proxy
(`app/api/admin/[...path]/route.ts`) checks `ALLOW.has(segments[0])`. Since the
backend path is `admin/collections`, the first segment is already `admin` —
**already allowed**. You only touch `ALLOW` when introducing a _new top-level_
segment (e.g. a public read at `collections/...`). For customer endpoints, add
the first segment to `ALLOW` in `app/api/store/[...path]/route.ts`.

**4. (Optional) Add a React Query hook** in the matching hooks file, pulling a
key from `query-keys.ts` and invalidating it on mutation:

```ts
export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) => createCollection(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "collections"] }),
  });
}
```

**5. Map 422s in the form** — catch the collection client's typed error, loop
`e.fields`, and call `setError` (see the snippet above). Make sure the input
field names match the backend's JSON keys so they line up.

### For a public server read instead

Add the read to the owning feature's server API and call `publicRequest()` with
the appropriate cache policy. Keep successful empty lists unchanged and let
failed primary reads throw; for a direct detail read, map only a typed 404 to
`null`. Add a `Paginated<T>` type from `lib/api/types.ts` if it is a list. No
proxy/allowlist change is needed because these APIs call the backend directly
server-side. If a dynamic route needs slug discovery, keep its fail-soft catch
inside that route's `generateStaticParams()` only.

---

## Quick reference — "which helper do I reach for?"

```
Need data on the SERVER (RSC / route handler)?
  ├─ public storefront data                         → feature-owned server API → publicRequest()
  └─ per-user / authenticated                        → apiFetch() from lib/api/client.ts

Need data in the BROWSER (client component)?
  ├─ customer/checkout resource                      → a hook in lib/api/hooks.ts | account-hooks.ts (→ storeRequest)
  └─ admin console                                   → the resource-owned client/action under features/<owner>/
```
