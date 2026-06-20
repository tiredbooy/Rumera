# Frontend API / Data-Access Layer

Everything the frontend uses to talk to the Go backend lives under
`lib/api/`, `lib/catalog/`, and a handful of top-level `lib/*.ts` fetchers. This
doc covers the **client/data layer**: the request helpers, the typed CRUD
functions, how the various response envelopes are unwrapped, how errors (and 422
field errors) propagate, and a recipe for adding a new endpoint.

> The **transport** (how the browser reaches the backend through same-origin
> route handlers, the staff/refresh logic, the allowlists) is documented in
> `apps/frontend/docs/bff-and-auth.md`. The backend response/error **envelope**
> contract lives in `apps/backend/docs/conventions.md`. This doc assumes both and
> does not repeat them.

---

## The big picture

There are **four** request entry points, split by *where the code runs* and
*which backend tier* it targets.

```
                         browser (client components)            server (RSC / route handlers)
                         ─────────────────────────────          ─────────────────────────────
  PUBLIC (no auth)       (auth forms POST to /api/public)        publicGet()  ── lib/catalog/*,
                                                                              lib/recipes.ts,
                                                                              lib/journal.ts
  CUSTOMER (session)     storeRequest()  ── lib/api/store-client.ts          serverApi()  ── lib/api/client.ts
                          ↳ via /api/store/* BFF proxy            ↳ injects bearer from session
  STAFF (session+staff)  adminRequest()  ── lib/api/admin-client.ts          serverApi()  (admin-tier paths)
                          ↳ via /api/admin/* BFF proxy
```

| Helper | File | Runs in | Reaches backend via | Unwraps |
|---|---|---|---|---|
| `apiFetch` / `serverApi` | `lib/api/client.ts` | **server only** (`import "server-only"`) | direct `fetch` to `${API_BASE}` | `{ data }` → `T` |
| `storeRequest` | `lib/api/store-client.ts` | browser | `/api/store/*` BFF proxy | **nothing** — returns body verbatim |
| `adminRequest` | `lib/api/admin-client.ts` | browser | `/api/admin/*` BFF proxy | `{ data }` → `T` |
| `publicGet` (local) | `lib/catalog/*`, `lib/recipes.ts`, `lib/journal.ts` | **server only** (ISR) | direct `fetch` to `${API_BASE}` | per-fetcher (see below) |

`API_BASE` is `${API_URL}/api/v1` (resolved in `lib/api/client.ts` from
`API_URL` → `NEXT_PUBLIC_API_URL` → `http://localhost:8080`).

---

## Response envelopes — three shapes, three unwrap rules

The backend returns one of three JSON shapes (see
`apps/backend/docs/conventions.md`). **There is no single unwrap path** — the
right one depends on the endpoint, and the helper you call reflects that choice.

| Envelope | Example endpoint | How callers unwrap |
|---|---|---|
| `{ data: T }` — single resource | `GET /products/:id`, `POST /admin/categories` | `adminRequest`/`serverApi` do `body?.data ?? body`. `storeRequest` callers do `.then(b => b.data)`. |
| `{ results: T[], pagination }` — list | `GET /products`, `GET /admin/users`, `GET /wallet/transactions` | typed as `Paginated<T>` (`lib/catalog/types.ts`); callers keep the **whole** envelope. |
| `{ error: { code, message, fields? } }` — failure | any 4xx/5xx | parsed into a typed error class (see *Error handling*). |

> `Paginated<T>` (in `lib/catalog/types.ts`):
> ```ts
> type Paginated<T> = { results: T[]; pagination: Pagination }
> type Pagination = { page; limit; total_items; total_pages; has_next; has_prev }
> ```

### Why `storeRequest` does NOT unwrap

`adminRequest` and `serverApi` collapse `{ data }` → `T` for you. `storeRequest`
deliberately returns the **raw body** because the store endpoints are a mix of
`{ data }` *and* `{ results, pagination }`, and the caller knows which it is:

```ts
// single resource → caller picks .data
storeRequest<{ data: Cart }>("cart").then(b => b.data)

// paginated list → caller keeps the envelope
storeRequest<Paginated<OrderListItem>>(`orders${buildQuery(params)}`)
```

This is why the hooks in `lib/api/hooks.ts` are littered with `.then(b => b.data)`
— it is the explicit unwrap step, not boilerplate.

---

## `adminRequest` — the admin client core

`lib/api/admin-client.ts`. One helper, then a flat set of typed CRUD functions.

```ts
export async function adminRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    ...opts,
    headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...opts.headers },
  })
  if (res.status === 204) return undefined as T   // DELETE / no-content
  if (!res.ok) return parseError(res)             // throws AdminApiError
  const body = await res.json().catch(() => null)
  return (body?.data ?? body) as T                // unwrap { data }, else pass through
}
```

Key behaviours:

- **`path` is the backend path after `/api/v1`.** Admin-namespaced calls include
  the literal `admin/` segment, so `adminRequest("admin/products")` hits
  `/api/admin/admin/products` (the proxy prefix + the backend path). Public
  catalogue reads the forms need (`categories`, `brands`, …) skip that segment.
- `204` → `undefined`. `body?.data ?? body` means it tolerates both
  `{ data }` and bare-object responses.
- On `!res.ok` it throws **`AdminApiError(status, code, message, fields?)`** —
  the `fields` map is what drives 422 → form mapping.

### Exported admin CRUD functions

All real, all in `admin-client.ts`. Grouped by resource:

| Resource | Functions | Backend (after `/api/v1`) |
|---|---|---|
| **Products** | `createProduct`, `updateProduct` | `admin/products`, `admin/products/:id` |
| **Variants** | `createVariant`, `updateVariant`, `deleteVariant` | `admin/products/:id/variants`, `admin/variants/:id` |
| **Images** | `listProductImages`, `uploadProductImage`, `reorderProductImages`, `setPrimaryImage`, `updateImageAlt`, `deleteProductImage` | `admin/products/:id/images[...]` |
| **Categories** | `listCategories`, `getCategoryTree`, `createCategory`, `updateCategory`, `deleteCategory` | `categories` (read), `admin/categories[/:id]` (write) |
| **Brands** | `listBrands`, `createBrand`, `updateBrand`, `deleteBrand` | `brands` (read), `admin/brands[/:id]` (write) |
| **Recipes** | `listAdminRecipes`, `getAdminRecipe`, `createRecipe`, `updateRecipe`, `deleteRecipe` | `admin/recipes[/:id]` |
| **Users** | `getAdminUser`, `adminUpdateUser`, `listUsers` | `admin/users[/:id]` |
| **Site settings** | `getSiteSettings`, `updateSiteSettings` | `admin/settings` (GET / **PUT**) |
| **Hero slides** | `listHeroSlides`, `createHeroSlide`, `updateHeroSlide`, `deleteHeroSlide` | `admin/hero-slides[/:id]` |

> **Tags** have no dedicated admin CRUD function. The `tags` segment *is*
> allowlisted in the admin proxy and products/recipes accept `tag_ids[]`, but
> there is no `createTag`/`listTags` in `admin-client.ts` today. Tag selection
> is driven by whatever the form loads; don't document tag CRUD that isn't built.

Reads vs writes split deliberately: `listCategories` / `listBrands` hit the
**public** read endpoints (`categories?limit=100`, `brands?limit=100`) — they
return `Paginated<T>` — while create/update/delete hit the `admin/`-namespaced
write endpoints and return the single resource.

### Request typing pattern

Every mutation takes a typed `*Input` that **mirrors the Go request struct**.
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

### The one special case: image upload

`uploadProductImage(productId, file, opts, onProgress)` does **not** go through
`adminRequest`. It uses a raw `XMLHttpRequest` so it can report real upload
progress via `xhr.upload.onprogress`, supports an `AbortSignal`, and posts
`multipart/form-data` (the admin proxy preserves the multipart boundary
verbatim). It still resolves the `{ data }` row and rejects with an
`AdminApiError` on failure — same contract, different transport.

---

## `storeRequest` — the customer client core

`lib/api/store-client.ts`. Thin, returns the body **verbatim**, throws
`ApiClientError(status, code, message)` on `!res.ok`. It has **no** `fields`
property — store/customer surfaces don't do per-field server validation mapping
(forms validate with zod up front; server errors are surfaced as toasts).

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
> *call shape* is built but the exact backend route/response is unconfirmed
> (`reviews/mine`, `reviews/pending`, `addresses/:id/default`,
> `recommendations`). Treat those as not-yet-verified.

> **`lib/api/admin-hooks.ts` is split-brain.** Its product/image hooks
> (`useCreateProduct`, `useProductImages`, …) call the **real** `admin-client.ts`
> functions. But orders/customers/inventory/reviews/recipes hooks still resolve
> the in-memory mock from `lib/admin/data.ts` (`const resolve = v => Promise.resolve(v)`,
> with a `TODO(api)` to swap for real calls). Don't present those as live yet.

---

## `serverApi` / `apiFetch` — server-side authenticated reads

`lib/api/client.ts`, `import "server-only"`. Used by RSC / route handlers that
need the customer's or admin's data without threading the token by hand:

```ts
export async function serverApi<T>(path, opts = {}): Promise<T> {
  const session = await auth()
  return apiFetch<T>(path, { ...opts, token: session?.accessToken })
}
```

`apiFetch` unwraps `{ data } ?? body`, throws **`ApiError(status, code, message)`**
on `!res.ok`, and defaults to `cache: "no-store"` (dashboard data is per-user)
unless the caller opts into caching.

---

## Public server-side fetchers (`lib/catalog/*`, `lib/recipes.ts`, `lib/journal.ts`)

These are **unauthenticated, server-only, ISR-cached** and **error-safe**: each
file defines its own local `publicGet` that `try/catch`es and returns `null`, and
the public fetcher then falls back to an empty/sane value. This is intentional —
`next build` and page rendering must never hard-fail when the backend is down.

```ts
async function publicGet<T>(path): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch { return null }
}
```

Revalidation windows differ by domain: catalogue/recipes/journal `3600s`,
recommendations `1800s`, reviews `600s`.

**Watch the envelope per fetcher** — they are not uniform, and the code unwraps
accordingly:

| Fetcher | File | Reads | Notes |
|---|---|---|---|
| `listProducts`, `getFeatured`, `allProductSlugs` | `lib/catalog/products.ts` | `{ results, pagination }` | returns `Paginated<T>` / arrays |
| `getProductById` | `lib/catalog/products.ts` | `{ data }` | detail keyed by **numeric id** |
| `getProductBySlug` | `lib/catalog/products.ts` | — | searches list for slug, then hydrates by id (no slug detail route) |
| `listCategories`, `getCategoryBySlug` | `lib/catalog/categories.ts` | `{ results }` | flat list (`limit=100`) |
| `categoryTree` | `lib/catalog/categories.ts` | `{ data }` | nested tree |
| `getReviewSummary`, `listReviews` | `lib/catalog/reviews.ts` | `{ data }` / `{ results, pagination }` | summary is `{ data }`, list is paginated top-level |
| `getTrending`, `getSimilar`, `getFrequentlyBoughtTogether` | `lib/catalog/recommendations.ts` | `{ data }` | items use `product_id` (not `id`) + `min/max_price` |
| `listRecipes` | `lib/recipes.ts` | `{ results, pagination }` | |
| `getRecipeBySlug` | `lib/recipes.ts` | **top-level** `RecipeDetail` | NOT wrapped in `{ data }` — guarded by `body?.id` |
| `getFeaturedRecipes`, `getRelatedRecipes`, `allRecipeSlugs` | `lib/recipes.ts` | `{ data }` *or* bare array | tolerates both (`Array.isArray(body) ? body : body.data`) |
| `listBlogs`/`listBlogPosts`, `getBlogBySlug`, `getBlogCategories`, `getRelatedBlogs`, `allBlogSlugs` | `lib/journal.ts` | `{ results, pagination }` (list), `{ data }` (detail/categories) | published-only |

> `lib/products.ts` is **not** a fetcher — it is a static in-repo demo catalogue
> (`products: Product[]`) plus the `faNum()` / `formatPrice()` display helpers.
> Don't confuse it with `lib/catalog/products.ts`. `endpoints.ts` is a central
> map of backend path strings; `query-keys.ts` holds React Query key factories.

---

## Error handling

Three typed error classes, one per request helper, all carrying
`(status, code, message)` parsed from the `{ error: { code, message } }`
envelope:

| Class | Thrown by | Extra |
|---|---|---|
| `ApiError` | `apiFetch` / `serverApi` (`lib/api/client.ts`) | — |
| `ApiClientError` | `storeRequest` (`lib/api/store-client.ts`) | — |
| `AdminApiError` | `adminRequest` & `uploadProductImage` (`lib/api/admin-client.ts`) | **`fields?: Record<string, string[]>`** |

Public `publicGet` fetchers do **not** throw — they swallow and fall back.

### 422 field errors → react-hook-form

Only `AdminApiError` carries `fields`. The backend returns validation failures as
`{ error: { code, message, fields: { <field>: ["msg", ...] } } }`. Admin forms
catch the error and map each field onto the form via `setError`. The pattern
(identical across `category-form.tsx`, `product-form.tsx`, `brand-form.tsx`,
`hero-form.tsx`, `user-edit-form.tsx`, `settings-form.tsx`, `recipe-form.tsx`):

```ts
function applyServerErrors(e: unknown) {
  if (e instanceof AdminApiError) {
    if (e.fields) {
      for (const [key, msgs] of Object.entries(e.fields)) {
        setError(key as keyof FormValues, { message: msgs[0] })  // first message wins
      }
    }
    toast.error(e.message)        // also surface the top-level message
  } else {
    toast.error("خطای غیرمنتظره رخ داد")  // unknown → generic toast
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

**1. Add the type(s)** in `lib/catalog/types.ts` (or co-located in the client),
mirroring the Go response/request structs exactly — same field names:

```ts
export type Collection = { id: number; title: string; slug: string; is_active: boolean }
export type CreateCollectionInput = { title: string; slug?: string | null }
export type UpdateCollectionInput = Partial<CreateCollectionInput> & { is_active?: boolean }
```

**2. Add the client functions** in `lib/api/admin-client.ts`, reusing
`adminRequest`. Remember the `admin/` segment for write paths:

```ts
export function listCollections() {
  return adminRequest<Paginated<Collection>>("admin/collections")
}
export function createCollection(input: CreateCollectionInput) {
  return adminRequest<Collection>("admin/collections", {
    method: "POST", body: JSON.stringify(input),
  })
}
export function updateCollection(id: number, input: UpdateCollectionInput) {
  return adminRequest<Collection>(`admin/collections/${id}`, {
    method: "PATCH", body: JSON.stringify(input),
  })
}
export function deleteCollection(id: number) {
  return adminRequest<void>(`admin/collections/${id}`, { method: "DELETE" })
}
```

**3. Allowlist the first path segment** in the proxy. The admin proxy
(`app/api/admin/[...path]/route.ts`) checks `ALLOW.has(segments[0])`. Since the
backend path is `admin/collections`, the first segment is already `admin` —
**already allowed**. You only touch `ALLOW` when introducing a *new top-level*
segment (e.g. a public read at `collections/...`). For customer endpoints, add
the first segment to `ALLOW` in `app/api/store/[...path]/route.ts`.

**4. (Optional) Add a React Query hook** in the matching hooks file, pulling a
key from `query-keys.ts` and invalidating it on mutation:

```ts
export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCollectionInput) => createCollection(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "collections"] }),
  })
}
```

**5. Map 422s in the form** — catch `AdminApiError`, loop `e.fields`, call
`setError` (see the snippet above). Make sure the input field names match the
backend's JSON keys so they line up.

### For a public (server-side, ISR) read instead

Add the fetcher to `lib/catalog/` (or a top-level `lib/*.ts`) with its own
error-safe `publicGet` + empty fallback, choose a `REVALIDATE` window, and
**unwrap to match the actual envelope** the backend returns (`{ data }` vs
`{ results, pagination }` vs top-level). Add a `Paginated<T>` type if it's a
list. No proxy/allowlist change is needed — these fetchers call the backend
directly server-side.

---

## Quick reference — "which helper do I reach for?"

```
Need data on the SERVER (RSC / route handler)?
  ├─ public, cacheable (catalogue/recipes/journal)  → a publicGet fetcher in lib/catalog | lib/recipes.ts | lib/journal.ts
  └─ per-user / authenticated                        → serverApi() from lib/api/client.ts

Need data in the BROWSER (client component)?
  ├─ customer/checkout resource                      → a hook in lib/api/hooks.ts | account-hooks.ts (→ storeRequest)
  └─ admin console                                   → an admin-client.ts function, usually via a lib/api/admin-hooks.ts hook
```
