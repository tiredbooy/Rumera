# Epic A — Surface the backend on the storefront (design spec)

**Date:** 2026-06-16 · **Branch target:** `dev` · **Status:** approved, implementing

## Problem
The Rumera backend implements a full recommendation engine, product reviews, wishlist, and interaction tracking — but the storefront never calls most of it. PDP "related" is a naive same-category query; the home "for-you" rail just echoes the taste quiz; reviews are write-only (never displayed); the account wishlist renders hardcoded sample data. This epic surfaces the existing capability with no backend changes (one allowlist edit aside).

## Architecture (follows the existing split)
- **Public + cacheable** → server fetchers with ISR, error-safe (return `[]`/`null` on failure), mirroring `lib/catalog/products.ts`. Used for recommendation rails + review display (also feeds JSON-LD).
- **Per-user + mutable** → client hooks over the `/api/store` BFF, mirroring `lib/api/hooks.ts`. Used for wishlist, for-you, posting reviews/reactions, interactions.

## Components & data flow

### 1. Recommendations (server-fetched, public)
- New `lib/catalog/recommendations.ts`: `getSimilar(productId)`, `getFrequentlyBoughtTogether(productId)`, `getTrending(params)` → call `/api/v1/recommendations/*`, ISR 1h, error-safe `[]`. Returns `RecommendationItem[]` (`{product_id,title,slug,brand,min_price,max_price,image_url,score,reason}`).
- New `components/catalog/recommendation-rail.tsx` (server component): title + grid of cards built from `RecommendationItem` (uses `image_url` via `SmartImage`, `slug` for links, `.hover-lift`). Renders nothing when empty.
- **PDP** (`app/(storefront)/products/[slug]/page.tsx`): replace the same-category "related" with `getSimilar(product.id)`; add a `getFrequentlyBoughtTogether` rail.
- **Home** (`app/(storefront)/page.tsx`): add a "پرطرفدارها" trending rail from `getTrending`.

### 2. For-you (client, authed)
- Add `recommendations` to the `/api/store` allowlist (`app/api/store/[...path]/route.ts`).
- New `useForYou()` hook (store-client → `recommendations/for-you`). Switch `components/home/for-you-rail.tsx` to render products from it; keep the taste-quiz CTA as the guest/empty fallback.

### 3. Recently-viewed (pure frontend)
- New `lib/recently-viewed.ts`: localStorage list (`{slug,title,image,price}`, cap 12, dedupe by slug) + `useRecentlyViewed()`.
- `components/catalog/recently-viewed-rail.tsx` (client): records the current product on PDP mount, renders the rest on PDP + home. SSR-safe; reserves height (no CLS).

### 4. Reviews (server display + client write)
- New `lib/catalog/reviews.ts`: `getReviewSummary(productId)` (`{average_rating,total_reviews,distribution}`) + `listReviews(productId, params)` (paginated). Server-fetched on the PDP.
- PDP renders: summary (avg, total, 5-bar distribution) + first page of reviews (stars, content, date, verified badge, helpful counts). `user_full_name` is empty from the API → show "خریدار تأییدشده" + date (real names = future 1-line backend change).
- Feed `average_rating`/`total_reviews` into `productDetailLd` as `aggregateRating` (SEO).
- `components/catalog/reviews-section.tsx` (client island): "write a review" dialog (`POST /reviews`, optimistic + toast; `reviews` already in allowlist), "helpful" reaction (`POST /reviews/:id/react`), "load more". Guests see a login prompt.

### 5. Wishlist (client, authed) — PDP + account
- New hooks in `lib/api/hooks.ts`: `useWishlist`, `useAddWishlistItem`, `useRemoveWishlistItem`, `useHasWishlistItem(variantId)`. Identity rules: add by **`product_variant_id`**; remove by **wishlist-item `id`**; has-check by **variant id**.
- **PDP**: wishlist heart lives in `product-purchase-panel.tsx` (it owns the selected variant). Initial state from `useHasWishlistItem`; toggle add/remove with optimistic UI + toast.
- **Account** (`components/account/wishlist-view.tsx`): bind to `useWishlist`; remove → item id; move-to-cart → variant id (`POST /cart/items`). Link by title (no `slug` in the wishlist response — known limitation; PDP linking deferred to a small backend tweak).
- No hearts on grid cards (they lack a variant id).

### 6. Interactions (client, authed)
- `useRecordInteraction()` (store-client → `recommendations/interactions`). Fire `view` on PDP mount and `add_to_cart` on add — fire-and-forget, ignore errors. Warms for-you/similar.

## Error / empty / loading states
Server rails: error-safe `[]` → rail hidden. Client sections: skeleton while loading, friendly empty state, error → retry. RTL logical props, ≥44px targets, reduced-motion, lucide-only, both themes — consistent with the design system.

## Out of scope (flagged for follow-up)
- Account "my reviews / pending reviews" tabs — **no backend route exists** (would 404). Left as-is; recommend a small backend endpoint.
- Adding `slug` to the wishlist response (enables wishlist→PDP links) — 1-line backend change.
- Hearts on grid/list cards — needs variant resolution.

## Verification
`tsc --noEmit` clean · `npm run lint` 0 new errors · `npm run build` succeeds · manual click-through (PDP, home, account wishlist) in light + dark. All server fetchers error-safe so a down backend never breaks render.

## Git
Implement on `dev`; commit Epic A + the three audit docs; `git push origin dev`.
