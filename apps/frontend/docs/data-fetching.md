# Data Fetching & State

How the Rumera storefront moves data between the backend and the UI: where each
read happens (server vs. client), how TanStack Query is wired, how mutations and
optimistic updates work, how URL state and form state are managed, and how the
user gets feedback. Read this before adding a new data-backed surface so the new
code matches the existing patterns and shares the same cache keys.

## The two-layer rule

There are two distinct fetch layers, and which one you use is decided by **who
is reading the data** — not by convenience.

| Layer | Used by | Helper | Talks to | Auth |
|-------|---------|--------|----------|------|
| **Public / server** | Server Components (catalogue, PDP, blog) | `lib/catalog/*` (`listProducts`, `getProductById`, …) | `${API_URL}/api/v1/*` directly | none (public) |
| **Authenticated / client** | Client Components + React Query | `storeRequest()` → `/api/store/*` BFF | the BFF proxy, which adds the bearer token | next-auth session |

```
┌─────────────────────────────────────────────────────────────────┐
│ Server Component (RSC)                                           │
│   await listProducts({ ... })  ──►  fetch  ──►  /api/v1/products │  (ISR, public)
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Client Component  ("use client")                                │
│   useQuery / useMutation  ──►  storeRequest("cart")             │
│        └─► fetch /api/store/cart  ──►  BFF route  ──►  /api/v1  │  (auth, no-store)
│                                       (adds Bearer token,        │
│                                        silent refresh on 401)    │
└─────────────────────────────────────────────────────────────────┘
```

The access token never reaches the browser — the BFF proxy
(`app/api/store/[...path]/route.ts`) reads it from the next-auth session
server-side, attaches it as `Authorization: Bearer`, and on a `401` does one
silent refresh + retry. See `docs/authentication.md` if it exists, or read the
route.

> Next.js 16 note: `params` and `searchParams` are **async** — always `await`
> them in Server Components (see `app/(storefront)/products/page.tsx`). Route
> groups like `(storefront)`/`(account)` add **no** URL segment. This is not the
> Next you may know from training data — see `AGENTS.md`.

---

## Server-side fetching (catalogue, RSC)

Public catalogue reads live in `lib/catalog/products.ts` (and siblings
`categories.ts`, `reviews.ts`, `recommendations.ts`). They run **on the server**
inside RSCs and are **ISR-cached** and **error-safe** — on any network/HTTP
failure they return an empty page or `null` so `next build` and page rendering
never hard-fail when the backend is down.

```ts
// lib/catalog/products.ts
const REVALIDATE = 3600 // 1h ISR

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function listProducts(params: ProductListParams = {}): Promise<Paginated<ProductListItem>> {
  const page = await publicGet<Paginated<ProductListItem>>(`/products${buildQuery(params)}`)
  return page ?? emptyPage<ProductListItem>() // never throws
}
```

A page consumes these directly — no React Query, no client hydration:

```tsx
// app/(storefront)/products/page.tsx  (Server Component)
export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams                      // async in Next 16
  const page = Math.max(1, Number(sp.page) || 1)

  const [data, categories] = await Promise.all([     // fetch in parallel
    listProducts({ page, limit: 12, search, sortBy: sp.sortBy, orderBy: sp.orderBy }),
    listCategories(),
  ])
  // ...render results + pagination links built with buildQuery(...)
}
```

For paginated **server** pages, pagination is plain `<Link href>` navigation —
the URL (`?page=2`) is the source of truth and re-running the RSC re-fetches.
There is no client query involved.

---

## Client-side fetching (TanStack Query)

### QueryClient setup

A single `QueryClient` is created once in `app/providers.tsx` (held in
`React.useState` so it survives re-renders) and provided app-wide:

```tsx
// app/providers.tsx
const [queryClient] = React.useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,        // 1 minute — data is "fresh" for 60s
          refetchOnWindowFocus: false, // no surprise refetches on tab focus
        },
      },
    })
)
```

| Setting | Value | Effect |
|---------|-------|--------|
| `staleTime` | `60_000` | Queries are fresh for 60s; no refetch on remount within that window. |
| `gcTime` | default (5 min) | Not overridden — TanStack's default applies. |
| `refetchOnWindowFocus` | `false` | Deliberate — avoids re-fetching the cart/wallet every time the tab regains focus. |

Provider order in `app/providers.tsx`:
`SessionProvider` → `QueryClientProvider` → `NuqsAdapter` → `DirectionProvider`
→ `ThemeProvider`. The session must wrap the query client because the BFF proxy
relies on the session.

> **There is no `HydrationBoundary` / `dehydrate` / `prefetchQuery` in this
> codebase.** Server-prefetched-then-hydrated React Query is **not** a pattern
> here — server data comes from `lib/catalog/*` rendered directly in RSCs, and
> client data is fetched on mount via hooks. If you introduce dehydration, you'd
> be establishing a new pattern; prefer the existing split first.

### Hook files

| File | Scope | Path it hits |
|------|-------|-------------|
| `lib/api/hooks.ts` | Cart, orders, addresses (list/create), wishlist, coupons, shipping, loyalty, subscriptions, gift cards, referrals, taste, alerts, personalised recs | `/api/store/*` |
| `lib/api/account-hooks.ts` | Wallet, address mutations (update/delete/set-default), the customer's own reviews, profile (`auth/me`), recommendations | `/api/store/*` |
| `lib/api/admin-hooks.ts` | Admin tables (orders, customers, inventory, reviews, recipes) + real product/image hooks | mock today; `/api/admin/*` for products/images |

`account-hooks.ts` intentionally **does not duplicate** hooks that already live
in `hooks.ts` — pages import each hook from its owning file so cache keys stay
shared (e.g. gift-card redeem invalidating `["wallet"]` refreshes the wallet
view).

> `lib/api/admin-hooks.ts` mostly resolves an **in-memory mock**
> (`lib/admin/data.ts`) today via `const resolve = (v) => Promise.resolve(v)`,
> so client admin tables render against a real query lifecycle before the
> `GET /api/v1/admin/*` endpoints exist. Keys/signatures are stable so only the
> `queryFn` bodies change when the endpoints land. Product/image admin hooks are
> already real through the product-owned actions under
> `features/admin/products/`.

### Reading data — `useQuery`

The canonical query hook: a key from the factory, a `queryFn` that calls
`storeRequest` and unwraps the envelope, and an `enabled` gate.

```ts
// lib/api/hooks.ts
export function useCart(enabled = true) {
  return useQuery({
    queryKey: queryKeys.cart,                                       // ["cart"]
    queryFn: () => storeRequest<{ data: Cart }>("cart").then((b) => b.data),
    enabled,
  })
}
```

`storeRequest<T>` (`lib/api/store-client.ts`) returns the backend body
**verbatim**, so callers pick `.data` (single-resource envelope) or `.results`
(paginated envelope) themselves. It throws a typed `ApiClientError(status, code,
message)` on non-2xx and returns `undefined` on `204`.

Backend envelopes (see `apps/backend/docs/conventions.md`):
- Single/action: `{ data: ... }` → unwrap with `.then(b => b.data)`.
- Paginated: `{ results, pagination }` → return whole `Paginated<T>` and read
  `.results` in the component.

```ts
// Paginated query — return the whole envelope
export function useOrders(params: { page?: number; status?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => storeRequest<Paginated<OrderListItem>>(`orders${buildQuery(params)}`),
    enabled,
  })
}
```

`placeholderData: (prev) => prev` is used for paged ledgers (e.g.
`useWalletTransactions`) to keep the previous page visible while the next loads.

### Query keys

All keys come from one factory, `lib/api/query-keys.ts`, so invalidation is
predictable. Use the factory; don't hand-write key arrays in components.

```ts
// lib/api/query-keys.ts
export const queryKeys = {
  products: {
    all: ["products"],
    list: (params) => ["products", "list", params ?? {}],
    detail: (slug) => ["products", "detail", slug],
  },
  orders: { all: ["orders"], list: (p) => ["orders", "list", p ?? {}], detail: (id) => ["orders", "detail", id] },
  cart: ["cart"],
  wishlist: ["wishlist"],
  wallet: ["wallet"],
  addresses: ["addresses"],
  // ...
}
```

Some hooks still use **inline** keys for resources not in the factory
(`["alerts"]`, `["loyalty"]`, `["subscriptions"]`, `["taste-profile"]`,
`["wishlist", "has", variantId]`). Admin and account sub-namespaces keep their
own local factories (`adminKeys`, `accountReviewKeys`, `profileKey`). If you add
a long-lived shared resource, prefer adding it to `queryKeys`.

---

## Mutations & cache updates

`useMutation` hooks call `storeRequest` with a method/body, then reconcile the
cache. There are three reconciliation styles in use — pick the cheapest one that
keeps the UI correct.

### 1. Seed the cache from the response (no refetch)

Cart mutations return the **fresh `Cart`**, so write it straight into the cache —
the UI updates with zero extra round-trips:

```ts
// lib/api/hooks.ts
export function useAddCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars) =>
      storeRequest<{ data: Cart }>("cart/items", { method: "POST", body: JSON.stringify(vars) })
        .then((b) => b.data),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart, cart),   // seed, don't invalidate
  })
}
```

`useUpdateProfile` and `useSaveTasteProfile` do the same — the PATCH/PUT returns
the updated resource, which is written via `setQueryData`.

### 2. Invalidate on success (refetch is cheap / shape differs)

When the mutation doesn't return the new list state, invalidate and let the
query refetch:

```ts
export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddressInput) =>
      storeRequest<{ data: Address }>("addresses", { method: "POST", body: JSON.stringify(input) })
        .then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses }),
  })
}
```

Mutations may invalidate **multiple** keys when one action touches several
views — e.g. `usePlaceOrder` invalidates both `queryKeys.cart` and
`queryKeys.orders.all`; `useRedeemPoints` seeds `["loyalty"]` and invalidates
`["loyalty","transactions"]` + `["wallet"]`.

### 3. Optimistic update (instant feedback, rollback on error) — wishlist

The wishlist heart flips **instantly** using the full `onMutate` → `onError` →
`onSettled` lifecycle. This is the canonical optimistic pattern in the codebase
(`useAddWishlistItem` / `useRemoveWishlistItem` in `lib/api/hooks.ts`):

```ts
export function useAddWishlistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (productVariantId: number) =>
      storeRequest<{ data: { wishlist_id: number } }>("wishlist/items", {
        method: "POST",
        body: JSON.stringify({ product_variant_id: productVariantId }),
      }),

    onMutate: async (variantId) => {
      await qc.cancelQueries({ queryKey: queryKeys.wishlist })          // 1. stop in-flight refetches
      const prev = qc.getQueryData<Wishlist>(queryKeys.wishlist)        // 2. snapshot for rollback
      if (prev && !prev.items.some((i) => i.variant_id === variantId)) {
        const optimistic = { id: -variantId, /* …negative sentinel… */ }
        qc.setQueryData<Wishlist>(queryKeys.wishlist, {                 // 3. write optimistic state
          ...prev, items: [optimistic, ...prev.items], total: prev.total + 1,
        })
      }
      qc.setQueryData(["wishlist", "has", variantId], true)            // flip the per-variant flag too
      return { prev }                                                   // 4. pass snapshot to onError
    },

    onError: (_e, variantId, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.wishlist, ctx.prev)      // 5. roll back
      qc.setQueryData(["wishlist", "has", variantId], false)
    },

    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.wishlist }), // 6. reconcile with server
  })
}
```

Key details that make it correct:
- The optimistic row uses a **negative sentinel id** (`-variantId`) so it's
  obviously a placeholder and gets replaced when `onSettled` invalidation
  refetches the real row.
- It also writes the **derived** `["wishlist", "has", variantId]` query so the
  PDP heart (`useHasWishlistItem`) updates without its own round-trip.
- `cancelQueries` in `onMutate` prevents an in-flight GET from clobbering the
  optimistic write.

> **When to go optimistic:** only for high-frequency, low-risk toggles where the
> server almost always agrees (wishlist heart). Cart, addresses, orders, etc.
> use the simpler seed-or-invalidate styles above. Note `ProductCard`
> (`components/product-card.tsx`) currently uses **local `useState` + a toast**
> for its add/wishlist affordances and is **not yet wired** to these mutation
> hooks — treat it as presentational until connected.

### Calling a mutation from a component

Pass per-call `onSuccess`/`onError` to `.mutate()` for UI side effects (toasts,
closing dialogs), and read `mutation.isPending` to disable buttons:

```tsx
// components/account/addresses-view.tsx
const create = useCreateAddress()

create.mutate(values, {
  onSuccess: () => { toast.success("آدرس جدید ثبت شد"); closeDialog() },
  onError:   () => toast.error("ثبت آدرس ناموفق بود"),
})

<Button disabled={create.isPending}>…</Button>
```

---

## URL state with nuqs

`nuqs` keeps filter/pagination state **in the URL** (shareable, back-button
friendly) without manual `URLSearchParams` plumbing. It's enabled by
`<NuqsAdapter>` in `app/providers.tsx` (the Next App Router adapter).

The reference usage is `components/account/wallet-view.tsx`. Note: the wallet
fetches a generous window once (`FETCH_LIMIT = 100`) and then filters/pages
**client-side** over the URL state — nuqs drives the view, not the fetch.

```tsx
// components/account/wallet-view.tsx
import { useQueryState, useQueryStates, parseAsStringEnum, parseAsString, parseAsInteger } from "nuqs"

// single value with a typed default → ?dir=credit
const [direction, setDirection] = useQueryState(
  "dir",
  parseAsStringEnum(["all", "credit", "debit"]).withDefault("all"),
)

// grouped values → ?from=…&to=…
const [{ from, to }, setRange] = useQueryStates({
  from: parseAsString.withDefault(""),
  to:   parseAsString.withDefault(""),
})

// numeric pagination → ?page=2
const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1))
```

Conventions seen in the code:
- Always pair a parser with `.withDefault(...)` so values are non-nullable.
- When a **filter** changes, reset the page: `setDirection(v); setPage(1)`.
- Clamp the page against the current result size and self-correct in an effect
  (`if (page > totalPages) setPage(totalPages)`), so a stale `?page=9` URL
  doesn't show an empty table.

> Server pages (e.g. the storefront `products` list) do **not** use nuqs — they
> read async `searchParams` and emit `<Link>`s built with `buildQuery(...)`.
> nuqs is for **client** components that filter in place.

---

## Query strings — `buildQuery`

`lib/api/qs.ts` is the one isomorphic helper for serialising params, used by
**both** server fetchers and client hooks. It skips `null`/`undefined`/`""`,
repeats array keys (`ids=1&ids=2`), and prefixes `?` only when non-empty.

```ts
buildQuery({ page: 2, search: "", sortBy: "price" }) // "?page=2&sortBy=price"
```

Use it everywhere instead of hand-building query strings.

---

## Form state — react-hook-form + zod

Forms use `react-hook-form` with a `zodResolver`. The zod schema is the **single
source of truth** for both validation and the inferred TypeScript type. Error
messages are Persian. The reference is `components/account/address-form.tsx`.

```tsx
// components/account/address-form.tsx
const schema = z.object({
  full_name: z.string().trim().min(2, "نام گیرنده را وارد کنید"),
  phone_number: z.string().trim().regex(/^09\d{9}$/, "شمارهٔ موبایل معتبر نیست"),
  postal_code: z.string().trim().regex(/^\d{10}$/, "کد پستی باید ۱۰ رقم باشد"),
  // ...
})
export type AddressFormValues = z.infer<typeof schema>  // type derived from schema

const { register, handleSubmit, setValue, control, formState: { errors } } =
  useForm<AddressFormValues>({ resolver: zodResolver(schema), defaultValues: { /* … */ } })
```

Patterns to follow:
- **Inputs:** spread `{...register("field")}`; show `errors.field?.message`.
- **Non-native controls** (shadcn `Select`, `Switch`): they don't emit DOM
  events RHF can register, so drive them with `useWatch({ control, name })` to
  read and `setValue(name, v, { shouldValidate: true })` to write.
- **Submit:** wrap with `handleSubmit(onSubmit)`; the form stays presentational
  and calls an `onSubmit` prop — the **mutation lives in the parent** (e.g.
  `addresses-view.tsx` owns `useCreateAddress`/`useUpdateAddress` and passes
  `submitting={create.isPending || update.isPending}` down to disable the
  button). This keeps forms reusable for both create and edit.

---

## Loading, empty & error states

Every client query surface renders the three branches explicitly — there is no
global spinner. The convention (see `account-overview.tsx`, `wallet-view.tsx`,
`addresses-view.tsx`):

| State | Render |
|-------|--------|
| `isLoading` | `<Skeleton>` placeholders shaped like the real content |
| `isError` | inline message + a **"تلاش دوباره"** button calling `query.refetch()` |
| empty (`data.length === 0`) | `<EmptyState>` / `<Placeholder>` with an icon + CTA |
| success | the real content |

Gate dependent queries with `enabled` (most hooks accept an `enabled = true`
arg, e.g. `useHasWishlistItem(variantId, enabled)` is `enabled && !!variantId`)
so they don't fire before their inputs exist.

---

## Toast feedback — sonner

`<Toaster position="bottom-left" dir="rtl" />` is mounted once in
`app/layout.tsx` (component wrapper at `components/ui/sonner.tsx`). Call `toast`
from anywhere client-side:

```tsx
import { toast } from "sonner"

toast.success("آدرس به‌روزرسانی شد")
toast.error("به‌روزرسانی ناموفق بود")
toast.success("به سبد خرید افزوده شد", { description: `${name} — ${formatPrice(price)}` })
```

Convention: fire toasts from the mutation's **per-call** `onSuccess`/`onError`
in the component (not inside the hook), so the same hook can be reused with
different messaging. Messages are Persian and `dir="rtl"`.

---

## Quick reference — adding a new authenticated surface

1. Add a typed hook in `lib/api/hooks.ts` (or `account-hooks.ts`): `useQuery`
   for reads, `useMutation` for writes, both via `storeRequest("<path>")`.
2. Use a key from `queryKeys`; add to the factory if it's a new shared resource.
3. Unwrap `.data` (single) or return `Paginated<T>` and read `.results` (list).
4. Mutations: **seed** the cache if the response returns the new state, else
   **invalidate** the affected key(s). Reserve optimistic `onMutate` for hot
   toggles like the wishlist.
5. Ensure the BFF allowlist (`app/api/store/[...path]/route.ts` `ALLOW` set)
   includes the first path segment, or the proxy returns `403 FORBIDDEN_PATH`.
6. In the component, render loading/error/empty/success branches and fire
   sonner toasts from per-call `onSuccess`/`onError`.

For a **public** read instead, add an error-safe fetcher to `lib/catalog/*` and
call it directly in a Server Component (no hook, no hydration).
