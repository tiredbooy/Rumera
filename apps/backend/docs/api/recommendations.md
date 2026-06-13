# Recommendations

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

The engine reads two first-party signal sources from the main database:

1. **`user_product_interactions`** — a lean, queryable implicit-feedback log
   (view, add_to_cart, purchase, wishlist, review, recipe_view, search_click).
   Each type carries a tuned weight (purchase ≫ view).
2. **Order history** — folded directly into profile building, so personalization
   works from existing data before any interaction is ever recorded.

A per-user **affinity profile** (top categories/brands/tags + preferred price
band) is derived from those signals and cached in
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

## Record an interaction

```
POST /recommendations/interactions
```

```json
{
  "product_id": 42,
  "interaction_type": "add_to_cart",
  "source": "product_page",
  "metadata": { "variant_id": 5, "position": 2 }
}
```

The server applies the configured weight for the interaction type. Returns
`204 No Content`. Call this from the storefront on views, cart adds, wishlist
adds, search-result clicks, and recipe views to continuously enrich
personalization.

## Profile

```
GET  /recommendations/profile           # view the caller's affinity profile
POST /recommendations/profile/recompute # rebuild it from latest signals
```

The profile exposes `top_categories`, `top_brands`, `top_tags` (each
`{id, score}`), `preferred_price_min` / `preferred_price_max`,
`engagement_score`, and `last_interaction_at`.
