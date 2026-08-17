# Recommendations

**Implementation (feature slice):** `internal/features/recommendations/`  
Composed from `internal/routes/routes.go`. Cron refresh uses `Service.RefreshActiveProfiles`. API contracts unchanged.


Personalized and contextual product recommendations, computed live against the
catalogue so results always reflect real prices, availability, and
relationships. Public surfaces work for guests; personalization requires an
authenticated user.

See [Authentication](../authentication.md) for the token model and trust tiers,
and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/recommendations/trending` | 🌐 public | Trending products (blends interactions + orders) |
| GET | `/recommendations/products/:id/similar` | 🌐 public | Content-similar products |
| GET | `/recommendations/products/:id/frequently-bought-together` | 🌐 public | Order co-occurrence |
| GET | `/recommendations/for-you` | 🔒 customer | Personalized picks |
| POST | `/recommendations/interactions` | 🔒 customer | Record an implicit-feedback signal |
| GET | `/recommendations/profile` | 🔒 customer | The caller's affinity profile |
| POST | `/recommendations/profile/recompute` | 🔒 customer | Rebuild the caller's profile |

Legend: 🌐 public · 🔒 customer · 🛡️ admin.

## How it works

The engine reads two first-party signal sources from the main database, plus an
optional explicit quiz:

1. **`user_product_interactions`** — a lean, queryable implicit-feedback log.
   Customer `POST /recommendations/interactions` may record `view`, `wishlist`,
   `review`, `recipe_view`, `search_click`, `add_to_cart`, and `purchase`.
   Unknown `product_id` is **404** (no insert). Paid `purchase` is also written
   server-side on `payments.Confirm` (PR-050d); `add_to_cart` is also written
   on cart add. Same-day `purchase` / `add_to_cart` (and `purchase` with the
   same `metadata.order_id`) do not double-weight.
2. **Order history** — folded directly into profile building, so personalization
   works from existing data before any interaction is ever recorded.
3. **Taste quiz** (`taste_profiles`) — declared categories / flavor / occasions
   blended into `/for-you` at request time when a row exists (see below).

A per-user **affinity profile** (top categories/brands/tags + preferred price
band) is derived from interactions and orders and cached in
`user_recommendation_profiles` for fast serving. Profiles are kept warm three
ways:

- a **nightly cron job** (`recommendation_refresh`) rebuilds profiles for every
  user active in the recent window, so `/for-you` reads a ready-made profile
  instead of computing one on the request path (see [Operations](../operations.md));
- they are still built **lazily** on the first `/for-you` for a brand-new user;
- and `POST /recommendations/profile/recompute` forces a rebuild on demand.

Every strategy degrades gracefully: `frequently-bought-together` falls back to
`similar`, and `for-you` backfills with `trending` so a response is never empty.

Shared query parameters: `limit` (default 12, ≤50), `category_id`,
`window_days` (default 30, trending only).

The `RecommendationItem` object:

| Field | Type | Notes |
|-------|------|-------|
| `product_id` | int64 | |
| `title` | string | |
| `slug` | string \| null | |
| `brand_id` / `brand` | int64 / string \| null | |
| `category_id` | int64 \| null | |
| `min_price` / `max_price` | number | active variant price band |
| `image_url` | string \| null | primary image |
| `score` | number | relevance score for this strategy |
| `reason` | string | `trending` \| `similar` \| `frequently_bought_together` \| `for_you` |

---

## Trending

```
GET /recommendations/trending?limit=12&window_days=30&category_id=4
```

Scores products by recent weighted interactions plus recent order volume. With
no signal yet it gracefully returns newest active products.

## Similar products

```
GET /recommendations/products/:id/similar
```

Content-based: scores other products by shared category (+3), brand (+2), and
each shared tag (+1) with the seed product.

## Frequently bought together

```
GET /recommendations/products/:id/frequently-bought-together
```

Ranks products that appear in the same completed orders as the seed product.
Falls back to `similar` for items without basket history.

## For you

```
GET /recommendations/for-you?limit=12
```

Scores candidate products against the caller's affinity profile (category, brand
and tag scores), excludes already-purchased products, and backfills with
trending when personalization is thin.

If the caller has a saved taste quiz (`GET /me/taste-profile`), those
preferences are blended **at serve time**:

- `categories` (e.g. `Whisky`, `Wine`) resolve to catalogue category ids by
  case-insensitive title or slug, including descendants so `Wine` also covers
  red/white children. Each match adds **+8** to that category affinity.
- `flavor` and `occasions` (quiz tags / styles) resolve to tag ids the same
  way. Each match adds **+4**.
- `budget_max` is stored on the quiz but is not a ranking term today.

A missing quiz, an empty quiz, or names that do not match the catalogue leave
ranking unchanged (behavioural profile, or trending on a cold user). Taste is
**not** written into `user_recommendation_profiles`; the nightly refresh stays
interaction- and order-driven.

## Record an interaction

```
POST /recommendations/interactions
```

```json
{
  "product_id": 42,
  "interaction_type": "wishlist",
  "source": "product_page",
  "metadata": { "variant_id": 5, "position": 2 }
}
```

The server applies the configured weight for the interaction type. `source` is
optional and limited to 40 characters. Returns `204 No Content`. Unknown
`product_id` is `404 NOT_FOUND` (existence is checked before insert; missing
catalogue rows never hit the FK). Call this from the storefront on views,
wishlist/review actions, search-result clicks, recipe views, and add-to-cart
to enrich personalization.

**Server-owned high-intent signals (PR-050d):**

- After a **paid** `payments.Confirm` (order checkout only), the backend
  inserts `purchase` (weight 10) per distinct order-line `product_id` with
  `source=payments.confirm` and `metadata.order_id`. Wallet top-up and gift-card
  purchase do not write purchase rows. Unpaid checkout does not.
- `POST /cart/items` and bulk add insert `add_to_cart` (weight 4) with
  `source=cart.add_item` after a successful line write. Recs failure is logged
  and does not fail Confirm or the cart mutation.

The HTTP endpoint still accepts `purchase` / `add_to_cart` from the client so
existing storefront fire-and-forget calls stay valid; inserts are idempotent
so FE + BE on the same UTC day (or the same paid `order_id`) do not
double-weight.

## Profile

```
GET  /recommendations/profile           # view the caller's affinity profile
POST /recommendations/profile/recompute # rebuild it from latest signals
```

The profile exposes `top_categories`, `top_brands`, `top_tags` (each
`{id, score}`), `preferred_price_min` / `preferred_price_max`,
`engagement_score`, and `last_interaction_at`.
