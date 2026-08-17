# Storefront commerce journey

**Who this is for:** engineers working on catalogue browsing, product cards,
cart, or checkout — the money path of the public site.

**Backend APIs:**
[products](../../../backend/docs/api/products.md) ·
[cart](../../../backend/docs/api/cart.md) ·
[orders](../../../backend/docs/api/orders.md) ·
[shipping](../../../backend/docs/api/shipping.md) ·
[coupons](../../../backend/docs/api/coupons.md) ·
[payments](../../../backend/docs/api/payments.md)

---

## Mental model

```
Browse catalogue / search / category / recipe shop
        │
        ▼
   Product card / PDP  ── add to cart (signed-in session; guests → /login)
        │
        ▼
      /cart  ── qty, remove, coupon  (same login wall; no cookie basket)
        │
        ▼
   /checkout  ── address · shipping · payment · place order
        │
        ▼
   confirmation  ── order id (server truth)
```

All **prices, stock, shipping quotes, and order totals** come from the Go API.
The frontend may format and display; it must not invent availability or totals.

### Failures (PH-012d)

Checkout, cart, gift redeem, and loyalty redeem use
`lib/api/user-facing-error` so shoppers see **specific** reasons
(`OUT_OF_STOCK`, coupon codes, wallet/points shortfalls, invalid gift codes)
instead of a generic “خطا”. See `docs/platform/api-layer.md` § User-facing errors.

Cart mutations go through `features/cart/errors` (`cartMutationErrorMessage`):
`AddToCartButton`, wishlist single add, and cart-line qty/remove. Known codes
(`OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE`, `INTERNAL_ERROR`, …) map to Persian;
unknown errors keep the add-to-cart fallback. Wishlist **bulk** skip reasons
still use `SKIP_REASON_LABELS` on the 200 response.

### Shipping package weight (PH-020c)

- Cart lines carry optional `weight_kg` from the catalogue.
- Checkout sums `packageWeightKg(items)` → `GET /shipping/available?region&weight&subtotal`.
- Region is the selected address **country** code only.
- Place-order path re-sums weights on the backend; missing line weights contribute 0 (admin should fix via PH-020b missing-weight signal).

---

## Catalogue

### Code map

| Concern | Location |
|---------|----------|
| Public list/detail API | `features/catalog/products/api/public.ts` |
| List URL/query parsing | `features/catalog/products/list-routing.ts` |
| Sort / filters UI | `product-sort.tsx`, list view |
| Truthful price + stock display | `catalogue-presentation.ts` |
| Card UI | `components/product-card.tsx` + `product-card-actions.tsx` |
| PDP | `product-detail-view.tsx`, gallery, variant picker |
| Categories | `features/catalog/categories/*` |
| Brands / tags | `features/catalog/brands/*`, `tags/*`. Home `getFeaturedBrands` is live `GET /brands` only — empty `[]`, errors throw, no invented liquor names (PR-080i). |
| Thin routes | `app/(storefront)/products/...`, `categories/...` |
| List metadata | `app/(storefront)/products/page.tsx` `generateMetadata` |

### Presentation rules (`catalogue-presentation.ts`)

- **Availability kinds:** ready / out_of_stock / unconfigured — derived from
  backend counts, not marketing copy.
- **Price display:** never pretend a free bottle when price is missing or zero
  without an explicit free state from the API.
- **Quick purchase:** only when a purchasable variant id is known and stock
  allows it. Multi-option rows stay on “انتخاب گزینه‌ها” — do not invent a
  cart target.
- **Card wishlist (PR-080n):** the API is **variant-scoped**
  (`POST wishlist/items` with `product_variant_id`). The corner heart toggles
  that id only when `purchasable_variant_id` is present (exactly one in-stock
  active variant). Multi-option cards have no list variant id, so the heart
  is a PDP link whose accessible name says options must be chosen first. Do
  not invent a product-level wishlist.
- **Public href:** always `/products/{slug}` with encoding; no dead links for
  inactive products.

### List metadata (PR-080l)

`/products` indexes only the unfiltered first page. `search`, `brand`,
non-default `sortBy`/`orderBy`, `page>1`, and redirect-needed query noise
are `noindex, nofollow` with canonical `/products`. PDP metadata is
unchanged (`products/[slug]`).

### List vs search outage (PR-080f)

`ProductListView` (`/products`) and `SearchView` (`/search`) catch a failed
`listProducts` and render `CatalogueLoadError` (alert + `router.refresh()`).
They must **not** reuse the zero-hits Placeholder / «نتیجه‌ای پیدا نشد» copy.
A successful empty page is still empty — no “if the service is down” hedge.

Category detail still lets a failed list throw to `error.tsx` (retry there).
Do not copy search’s old `settleProducts → []` pattern onto other primary
catalogue reads.

### Caching

Catalogue list uses short revalidate + tags
(`PRODUCT_CATALOGUE_CACHE_TAG`, home tags). PDP uses per-product tags. Admin
product writes revalidate via `lib/admin-revalidation.ts` — see
[media-and-cache.md](./media-and-cache.md).

---

## Cart

| Concern | Location |
|---------|----------|
| Types | `features/cart/types.ts` |
| API (BFF) | `features/cart/api.ts` |
| Validations | `features/cart/validations.ts` |
| UI | `features/cart/components/*` |
| Route | `app/(storefront)/cart` |

Cart mutations are **authenticated/session** paths through `storeRequest` →
`/api/store/cart...`. React Query owns client cache invalidation for the cart
key set in `lib/api/query-keys.ts`.

### Auth required (intended, PR-004c)

Add-to-cart and `/cart` require a **signed-in customer**. There is **no guest /
cookie / anonymous cart** and no merge-on-login. A guest `401` is the correct
response, not a missing storefront feature. Product must ask before anyone
builds a cookie basket (explicit non-goal of this program).

| Layer | What happens without a session |
|-------|--------------------------------|
| Store BFF `/api/store/cart*` | `401 SESSION_EXPIRED` (`sign in required`). `cart` is on the store allowlist, never `/api/public`. See [bff-and-auth.md](../platform/bff-and-auth.md). |
| Go cart API | `401 UNAUTHORIZED`. Every route is `Authorization: Bearer`. Invariants in [backend cart.md](../../../backend/docs/api/cart.md) (**Auth-only**, **One cart per user**). |
| Add-to-cart button | Session check first: toast «برای افزودن به سبد ابتدا وارد شوید» then `/login?callbackUrl=…`. Does not POST. |
| `/cart` page + header drawer | Login wall. `useCart(enabled)` is **false** until authenticated, so guests never hit the BFF. |
| Edge proxy | Does **not** bounce `/cart` (only `/account` and `/admin`). The page itself shows the wall. Checkout is separately `requireUser("/checkout")`. |

`useCart(false)` / the login wall are how the UI avoids treating `401` as an
empty basket. Do not add `localStorage` / cookie line items, and do not invent
a guest merge.

**Do not confuse with PR-004a.** The founder add-to-cart **500 after login**
was `GetOrCreate` `ON CONFLICT (user_id)` without `UNIQUE NOT NULL` on
`carts.user_id`. Guests already got `401`, not that 500. The unique constraint
is the one-cart-per-user invariant; it is not a guest-cart implementation.

---

## Checkout

| Concern | Location |
|---------|----------|
| Flow UI + state | `features/checkout/components/checkout-flow.tsx` |
| Place order | `features/orders/hooks.ts` (`usePlaceOrder`) |
| Package weight | `features/checkout/package-weight.ts` |
| Addresses | `features/addresses/*` |
| Shipping quotes | `features/shipping/api.ts` |
| Coupons | `features/coupons/*` |
| Confirmation | `app/(storefront)/checkout/confirmation/[id]` + `features/orders/components/order-confirmation-view.tsx` |

Checkout has **no** local `api.ts` / `types.ts` / `validations.ts`. Those empty
feature-split shells were deleted (PR-035d). Wire types and mutations live in
the domain modules the wizard already imports (`addresses`, `cart`, `orders`,
`shipping`, `coupons`).

### Flow principles

1. Load authoritative cart + address book from the API.
2. Request shipping methods with the selected address (server quote).
3. Validate client forms for UX, but **reject** based on API errors if the
   server disagrees.
4. Place order → redirect/confirm with server order id.
5. Payment gateway redirects/webhooks are backend-owned; the confirmation page
   reads order state, it does not “complete” payment itself.

**`payment_url` (PR-030c):** wallet top-up and gift purchase pending UIs show
«پرداخت در درگاه» only when the intent includes a non-empty `payment_url`.
`POST /orders` does **not** return that field yet (PR-020f) — checkout must
not invent a start URL. Confirmation copy is PR-030a.

**Bank transfer (PR-030d):** there is no IBAN API. Checkout copy must say the
customer pays **offline** and the order stays pending until staff mark paid.
Do not invent account numbers or imply instant / already-confirmed pay.
Wallet can settle on create (PR-020a). See [checkout.md](./checkout.md).

### Confirmation copy (PR-030a)

`features/orders/components/order-confirmation-view.tsx` gates the hero on
the same **paid-like** set as loyalty (`paid`, `processing`,
`ready_to_ship`, `shipped`, `out_for_delivery`, `delivered`):

| Status | Eyebrow / heading | Must not say |
|--------|-------------------|--------------|
| Paid-like | «سفارش تأیید شد» / «سپاس از خرید شما» | — |
| `pending` | «سفارش ثبت شد» + «در انتظار پرداخت» | «سفارش تأیید شد», «سپاس از خرید شما», money taken |
| `payment_failed` | «سفارش ثبت شد» + «پرداخت ناموفق» | same as pending |
| Other unpaid | «سفارش ثبت شد» + `ORDER_STATUS_FA` | same as pending |

The status badge always uses `ORDER_STATUS_FA`. Place-order toast
«سفارش ثبت شد» is still honest; this page must match **order status**,
not assume webhook settle.

Loyalty earn is **after** `payments.Confirm`, not on place-order. Checkout
shows a discreet link to `/account/rewards` and must **not** invent a points
amount from the cart total. See [loyalty.md](./loyalty.md).

### Admin fulfillment vs refund (PR-062b)

Storefront confirmation and account history **display** `ORDER_STATUS_FA`.
They do not advance warehouse status or refund. Staff fulfillment on
`/admin/orders/:id` (`OrderActions`) PATCHes only the warehouse graph
(PR-020l). Refund is `POST /admin/orders/:id/refund` behind a confirm —
never a `refunded` option in the status dropdown. See
[admin-console.md](./admin-console.md) § Orders.

**Deep dive (reserve → pending payment → HMAC webhook → deduct):**
[payments-and-webhooks](../../../backend/docs/architecture/payments-and-webhooks.md).

### Failure UX

Validation errors, empty cart, unavailable shipping, and payment failures must
remain keyboard-accessible and readable in RTL. Automated coverage for these
paths is Task 062 (Playwright).

---

## Cross-feature entry points

| From | Into commerce |
|------|----------------|
| Recipe ingredients | [recipe-commerce.md](./recipe-commerce.md) — anchors + shoppable cards |
| Journal product embeds | `features/journal` product cards |
| Recommendations | `features/recommendations` + product card |
| Search | `/search` (Meilisearch-backed when index is warm) |

---

## Testing anchors

- `features/catalog/products/catalogue-presentation.test.ts`
- `features/catalog/products/components/product-card.test.tsx`
- `features/catalog/products/components/product-card-actions.test.tsx`
- `features/checkout/components/checkout-state.test.tsx`
- `features/orders/components/order-confirmation-view.test.tsx`
- `features/recipes/commerce.test.ts`

When changing presentation rules, update these tests first (TDD-friendly).
