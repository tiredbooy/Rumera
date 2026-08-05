# Frontend domain map

**Who this is for:** anyone who needs to know *which folder owns which product
capability* and how domains are allowed to depend on each other.

**Companion:** [Architecture](../platform/architecture.md) · [API layer](../platform/api-layer.md) ·
repo-wide [Documentation map](../../../../docs/DOCUMENTATION-MAP.md)

---

## Rule of ownership

1. **Business capability → `features/<domain>/`**  
   Types, public/server API modules, React Query hooks, validations, and UI for
   that domain live together.
2. **Routes stay thin** — `app/**/page.tsx` imports one view component and maybe
   metadata. No SQL-shaped fetch logic in the route file.
3. **`lib/` is infrastructure**, not a dumping ground for catalogue types  
   Allowed: api clients, auth, rbac, media, seo, pwa, site, cache tags, brand.
4. **`components/ui` and `components/brand`** are presentation primitives. They
   must not call the backend.
5. **Cross-domain imports** are OK when one domain *consumes* another’s public
   types/API (e.g. recipes → catalogue products). Prefer importing the domain’s
   exported types, not reaching into private component internals.

---

## `features/` inventory

| Domain folder | Product meaning | Typical routes / surfaces |
|---------------|-----------------|---------------------------|
| `auth` | Login, register, OTP, password reset UI | `(auth)/login`, register, forgot/reset |
| `profile` | Customer profile edit | account profile |
| `account` | Account shell / overview chrome | `(account)/account/*` layout |
| `addresses` | Address book | account + checkout |
| `cart` | Cart line items, qty, coupons attach | `/cart`, header cart |
| `checkout` | Multi-step checkout flow | `/checkout`, confirmation |
| `orders` | Order list/detail (customer + admin pieces) | account orders, admin orders |
| `payments` | Payment presentation / admin boards | admin payments |
| `shipping` | Shipping methods / quotes | checkout, admin shipping |
| `coupons` | Coupon types + admin issuer | checkout, admin coupons |
| `catalog/products` | List, PDP, cards, catalogue presentation | `/products`, home rails |
| `catalog/categories` | Category index + landing | `/categories` |
| `catalog/brands` | Brands + marquee | home, admin brands |
| `catalog/tags` | Tag directory | `/tags` |
| `recipes` | Cocktail recipes + commerce helpers | `/recipes` |
| `journal` | Editorial articles (blog) | `/journal` |
| `hero-slides` | Homepage hero CMS | home, admin hero |
| `home` | Homepage composition only | `/` |
| `recommendations` | Trending / similar rails | home, PDP |
| `wishlist` | Customer wishlist | account |
| `reviews` | Product reviews | PDP, admin |
| `product-alerts` | Back-in-stock / price alerts | PDP / account |
| `wallet` | Customer wallet | account |
| `loyalty` | Points earn/redeem UI | account |
| `gift-cards` | Gift card purchase / admin issue | account, admin |
| `subscriptions` | Subscription products (if enabled) | account / admin |
| `referral` | Referral codes | account |
| `taste` | Taste profile | account |
| `customers` | Admin customer CRM | `/admin/customers` |
| `inventory` | Stock movements / levels | `/admin/inventory` |
| `analytics` | Admin analytics widgets | `/admin`, analytics boards |
| `admin/*` | Staff boards for each resource | `/admin/...` |
| `dashboard` | Admin chrome: shell, page header, stat cards | all admin layouts |
| `storefront/navigation` | Header, mega-menu, mobile drawer, logo | storefront layout |
| `compliance` | Age gate | storefront layout |
| `image-uploader` | Shared admin upload UX | product/recipe forms |
| `settings` | Site settings | `/admin/settings` |
| `motion` | Reveal / reduced-motion helpers | marketing sections |

Admin feature boards often live under `features/admin/<resource>/` while shared
domain API modules stay under the customer-facing domain name (e.g.
`features/inventory/api` used by admin pages).

---

## `lib/` map (infrastructure)

| Path | Responsibility |
|------|----------------|
| `lib/api/public.ts` | Server-side unauthenticated fetch to Go API |
| `lib/api/client.ts` | Server-side authenticated `apiFetch` |
| `lib/api/store-client.ts` | Browser → `/api/store/*` BFF |
| `lib/api/types.ts` | Envelope + pagination types matching Go |
| `lib/api/error-semantics.ts` | Typed 404 / safe error context |
| `lib/auth/*` | Auth.js config, session guards, token helpers |
| `lib/rbac/*` | Permissions, roles, `can()`, admin nav |
| `lib/media/*` | Resolve media URLs + storefront policy |
| `lib/seo/*` | Metadata helpers + JSON-LD builders |
| `lib/pwa/*` | Install / runtime config |
| `lib/cache-tags.ts` | Next.js cache tag constants |
| `lib/admin-revalidation.ts` | Tag/path plans after admin writes |
| `lib/apply-admin-revalidation.ts` | Executes revalidation plans |
| `lib/brand.ts` | Logo asset registry |
| `lib/site.ts` | Site name, URL, SEO defaults |
| `lib/products.ts` | `faNum`, `formatPrice` display helpers |

---

## Route groups → URL

| Folder | URL effect |
|--------|------------|
| `app/(storefront)/` | **No** segment — `/`, `/products`, … |
| `app/(auth)/` | **No** segment — `/login`, … |
| `app/(account)/account/` | `/account/...` |
| `app/admin/` | **Real** segment `/admin/...` |
| `app/api/{public,store,admin}/` | BFF proxies |
| `app/api/auth/` | Auth.js handlers |

---

## Adding a new domain (checklist)

1. Create `features/<name>/{types.ts, api or api/, components/, validations?}`.
2. Mirror backend wire types from Go JSON tags (see contract policy in
   `refactor-workstreams/Refactor-Docs/TASKS.md` — business names, snake_case
   keys).
3. Add a thin `app/.../page.tsx` that only renders the feature view.
4. If the surface is public + cacheable, choose tags from `lib/cache-tags.ts`
   and extend `admin-revalidation` when admin writes should bust cache.
5. Document the domain in this file and, if non-trivial, a short feature guide.

---

## Related guides

| Domain | Dedicated doc |
|--------|----------------|
| Media + cache tags | [media-and-cache.md](./media-and-cache.md) |
| Cart / checkout / catalogue | [storefront-commerce.md](./storefront-commerce.md) |
| Search | [search.md](./search.md) |
| Customer account | [account-tour.md](./account-tour.md) |
| Home, journal, recipes, SEO | [content-and-seo.md](./content-and-seo.md) |
| Recipe shoppable journey | [recipe-commerce.md](./recipe-commerce.md) |
| Admin shell + modules | [admin-console.md](./admin-console.md) |
| Admin inventory | [inventory.md](./inventory.md) |
| PWA | [pwa.md](./pwa.md) |
| Brand marks | [brand-system.md](./brand-system.md) |
| Prometheus board | [api-monitoring.md](./api-monitoring.md) |
