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
   Product card / PDP  ── add to cart (BFF + session)
        │
        ▼
      /cart  ── qty, remove, coupon
        │
        ▼
   /checkout  ── address · shipping · payment · place order
        │
        ▼
   confirmation  ── order id (server truth)
```

All **prices, stock, shipping quotes, and order totals** come from the Go API.
The frontend may format and display; it must not invent availability or totals.

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
| Brands / tags | `features/catalog/brands/*`, `tags/*` |
| Thin routes | `app/(storefront)/products/...`, `categories/...` |

### Presentation rules (`catalogue-presentation.ts`)

- **Availability kinds:** ready / out_of_stock / unconfigured — derived from
  backend counts, not marketing copy.
- **Price display:** never pretend a free bottle when price is missing or zero
  without an explicit free state from the API.
- **Quick purchase:** only when a purchasable variant id is known and stock
  allows it.
- **Public href:** always `/products/{slug}` with encoding; no dead links for
  inactive products.

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

---

## Checkout

| Concern | Location |
|---------|----------|
| Flow UI + state | `features/checkout/components/checkout-flow.tsx` |
| API | `features/checkout/api.ts` |
| Types / validations | `features/checkout/types.ts`, `validations.ts` |
| Addresses | `features/addresses/*` |
| Shipping quotes | `features/shipping/api.ts` |
| Coupons | `features/coupons/*` |
| Confirmation | `app/(storefront)/checkout/confirmation/[id]` |

### Flow principles

1. Load authoritative cart + address book from the API.
2. Request shipping methods with the selected address (server quote).
3. Validate client forms for UX, but **reject** based on API errors if the
   server disagrees.
4. Place order → redirect/confirm with server order id.
5. Payment gateway redirects/webhooks are backend-owned; the confirmation page
   reads order state, it does not “complete” payment itself.

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
- `features/checkout/components/checkout-state.test.tsx`
- `features/recipes/commerce.test.ts`

When changing presentation rules, update these tests first (TDD-friendly).
