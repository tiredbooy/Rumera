# Media URLs and storefront cache

**Who this is for:** engineers displaying product/recipe/journal images, or
wiring admin mutations that must update the public storefront immediately.

**Backend companion:**
[`apps/backend/docs/architecture/media-pipeline.md`](../../../backend/docs/architecture/media-pipeline.md)

---

## Media: one resolver, origin-independent storage

### What is stored in the database?

Prefer **paths without host**:

| Stored value | Meaning |
|--------------|---------|
| `/media/products/abc.webp` | Local pipeline object |
| `products/abc.webp` | Storage key (normalized to `/media/...`) |
| `https://cdn.example/...` | External absolute URL (left alone) |

Never bake `http://localhost:8080` into content rows — local FE (:3000) and API
(:8080) must be free to diverge.

### Where resolution happens

**Only** in:

```
lib/media/resolve-media-url.ts
  configuredMediaOrigin()
  resolveMediaUrl()
  mediaTransformUrl()
  normalizeMediaStorageKey()
  isMediaPipelinePath()
```

Policy helpers for storefront rendering:

```
lib/media/storefront-policy.ts
components/storefront-media.tsx   # preferred storefront image component
components/smart-image.tsx        # general smart image (admin/upload previews too)
components/optimized-image.tsx    # legacy/optimized wrapper if still referenced
```

### Environment

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_MEDIA_BASE_URL` | Preferred media origin (no path) |
| `NEXT_PUBLIC_API_URL` | Fallback origin in local split setups |
| _(empty)_ | Same-origin `/media/...` behind nginx/proxy |

**Production:** a *configured* media/API origin must be `https://` (or empty for
same-origin). Absolute content URLs already in the DB are not rewritten.

### UI usage pattern

```tsx
import { StorefrontMedia } from "@/components/storefront-media";

<StorefrontMedia
  src={product.image_url}   // may be relative /media/...
  alt={product.title}
  sizes="(max-width: 768px) 50vw, 25vw"
  priority={aboveTheFold}
/>
```

Do **not** concatenate `API_URL + path` in feature components.

### Service worker note

`public/sw.js` **must not** cache cross-origin media or API responses. Static
same-origin assets and the offline shell are fair game. See [pwa.md](./pwa.md).

---

## Cache tags and write-through revalidation

### Why tags exist

Public RSC reads use `fetch` cache with Next tags so an admin write can expire
the right surfaces without waiting for TTL alone.

Constants live in **`lib/cache-tags.ts`**:

| Tag | Typical consumers |
|-----|-------------------|
| `storefront:home` | Homepage shell |
| `storefront:products` | Catalogue lists |
| `storefront:product:{id}` | Single PDP |
| `storefront:categories` | Category directory |
| `storefront:hero` | Hero slides |
| `storefront:recipes` | Recipe lists |
| `storefront:journal` | Journal lists |
| `storefront:brands` | Brand marquee / lists |
| `storefront:recommendations` | Rails |

### How a public API attaches tags

Example pattern (`features/catalog/products/api/public.ts`):

```ts
const PRODUCT_LIST_OPTIONS = {
  cache: "force-cache",
  next: {
    revalidate: 60,
    tags: [PRODUCT_CATALOGUE_CACHE_TAG, HOME_CACHE_TAG],
  },
};
```

Each domain chooses TTL + tags intentionally — copy an existing domain, don’t
invent ad-hoc string tags.

### How admin writes bust cache

1. Admin BFF mutation succeeds.
2. Call `getAdminRevalidationPlan(method, pathSegments)` from
   `lib/admin-revalidation.ts`.
3. Apply with `applyAdminRevalidation(plan)` (`lib/apply-admin-revalidation.ts`)
   which runs `revalidateTag` / `revalidatePath`.

Plans map HTTP paths (products, categories, hero, recipes, journal, brands, …)
to the tags **and** path list that must refresh.

**Rule:** if you add a new public cache tag, update the revalidation plan for
every admin write that should invalidate it — otherwise the storefront will look
stale after CMS edits.

---

## Soft-fail vs hard-fail

| Surface | On API failure |
|---------|----------------|
| Homepage sections | Soft-fail empty / fallbacks (`HomeView` settle helpers) |
| `generateStaticParams` slug discovery | Soft-fail empty list |
| Primary detail pages | Typed 404 → `null`; other errors → error boundary |
| Sitemap / `llms.txt` | Soft-fail dynamic sections; static routes remain |

Do not hide **business** errors on money paths (cart, checkout, payments).

---

## Related tests

- `lib/media/resolve-media-url.test.ts`
- `lib/media/storefront-policy.test.ts`
- `lib/admin-revalidation.test.ts`
- `lib/seo/jsonld.test.ts` (structured data image URLs)
