# Recipes

**Implementation (feature slice):** `internal/features/recipes/`  
Composed from `internal/routes/routes.go`. Media cleanup via `MediaCleaner`.
Public detail is Redis-cached with eager write invalidation. API contracts unchanged.

Content-commerce recipes (cocktails & serves) with a publishing workflow, SEO
metadata, schema.org/Recipe structured data, and **shoppable products** that turn
a recipe page into a storefront. Public reads are published-only; writes are
admin-only.

See [Authentication](../authentication.md) for the token model and trust tiers,
and [Conventions](../conventions.md) for the response/error envelope.

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/recipes` | 🌐 public | List published recipes (paginated, filterable) |
| GET | `/recipes/featured` | 🌐 public | Featured published recipes |
| GET | `/recipes/sitemap` | 🌐 public | Slugs + lastmod for `sitemap.xml` |
| GET | `/recipes/:slug` | 🌐 public | Fetch one published recipe (hydrated, records a view) |
| GET | `/recipes/:slug/related` | 🌐 public | Related recipes ("you might also like") |
| GET | `/products/:id/recipes` | 🌐 public | Recipes that use a product (cross-sell) |
| GET | `/admin/recipes` | 🛡️ admin | List recipes, any status |
| POST | `/admin/recipes` | 🛡️ admin | Create a recipe (with ingredients/products/tags) |
| GET | `/admin/recipes/:id` | 🛡️ admin | Fetch one recipe by numeric id |
| PATCH | `/admin/recipes/:id` | 🛡️ admin | Update a recipe |
| DELETE | `/admin/recipes/:id` | 🛡️ admin | Delete a recipe |

Legend: 🌐 public · 🔒 customer · 🛡️ admin.

The `Recipe` object:

| Field | Type | Notes |
|-------|------|-------|
| `id` | int64 | |
| `title` | string | |
| `slug` | string | URL-safe; auto-generated from title when omitted; unique; collision is `409 CONFLICT` |
| `excerpt` | string \| null | short teaser |
| `description` | string \| null | |
| `content` | string | full instructions |
| `difficulty` | enum | `easy` \| `medium` \| `hard` |
| `prep_time_minutes` | int | |
| `cook_time_minutes` | int | |
| `total_time_minutes` | int | generated (`prep + cook`) |
| `servings` | int | |
| `calories` | int \| null | per serving |
| `cocktail_type` | string \| null | e.g. `cocktail`, `mocktail`, `punch` |
| `glass_type` | string \| null | e.g. `highball`, `coupe` |
| `serving_suggestion` | string \| null | |
| `image_url` | string \| null | |
| `image_alt` | string \| null | cover-image alternative text |
| `status` | enum | `draft` \| `published` \| `archived` |
| `is_featured` | bool | |
| `published_at` | string (date-time) \| null | auto-stamped on first publish |
| `view_count` | int64 | |
| `meta_title` | string \| null | SEO |
| `meta_description` | string \| null | SEO |
| `meta_keywords` | string[] \| null | SEO |
| `canonical_url` | string \| null | SEO |
| `og_image_url` | string \| null | Open Graph image |
| `user_id` | int64 \| null | author |
| `created_at` / `updated_at` | string (date-time) | |

The hydrated `RecipeDetail` (returned by `/recipes/:slug` and admin reads) adds:

| Field | Type | Notes |
|-------|------|-------|
| `ingredients` | RecipeIngredient[] | ordered by `sort_order` |
| `products` | ShoppableProduct[] | live price/brand/image/availability for "Add to cart" |
| `tags` | `{id, title}[]` | |
| `structured_data` | object | ready-to-embed schema.org/Recipe JSON-LD |

The `ShoppableProduct` object (the sales driver):

| Field | Type | Notes |
|-------|------|-------|
| `recipe_product_id` | int64 | |
| `product_variant_id` | int64 | add this to the cart |
| `product_id` | int64 | |
| `product_title` | string | |
| `product_slug` | string \| null | |
| `brand` | string \| null | |
| `sku` | string \| null | |
| `price` | number | current variant price |
| `compare_at_price` | number \| null | |
| `image_url` | string \| null | |
| `available_stock` | int | uncommitted stock, clamped at zero |
| `is_available` | bool | active product/variant with positive price and uncommitted stock |
| `quantity` | string \| null | exact decimal amount used in the recipe |
| `unit` | string \| null | |
| `sort_order` | int | |
| `is_primary` | bool | the hero bottle |
| `role` | string \| null | `base_spirit` \| `mixer` \| `garnish` \| `recommended` |

---

## List recipes

```
GET /recipes
```

Query parameters (all optional): `page`, `limit` (≤100), `sortBy`
(`published_at` \| `created_at` \| `updated_at` \| `title` \| `view_count` \|
`total_time`), `orderBy` (`asc` \| `desc`), `search` (title/excerpt via
`rumera_search_normalize`; Arabic-yeh/kaf match Persian; `%`, `_`, and `\`
are not wildcards), `difficulty`,
`is_featured`, `tag_id`, `variant_id`, `max_time` (max total minutes).

Public listing is always restricted to `status=published` **and** a live
`published_at` window (`IS NULL OR <= NOW()`). A future stamp is a schedule
and is omitted like a draft (PR-070g). Admin `GET /admin/recipes` is
unfiltered. Returns the [paginated envelope](../conventions.md) of lightweight
`RecipeListItem` cards.

## Get a recipe by slug

```
GET /recipes/:slug
```

Returns the hydrated `RecipeDetail` (ingredients, shoppable products, tags, and
JSON-LD). Increments `view_count` asynchronously. 404 if the recipe is not
published **or** `published_at` is still in the future (PR-070g). NULL
`published_at` on a published row stays live (legacy).

## Create a recipe

```
POST /admin/recipes
```

```json
{
  "title": "Dark and Stormy",
  "content": "Build over ice…",
  "difficulty": "easy",
  "prep_time_minutes": 5,
  "servings": 1,
  "cocktail_type": "cocktail",
  "status": "published",
  "meta_title": "Dark and Stormy Recipe",
  "meta_description": "The classic rum & ginger highball.",
  "meta_keywords": ["rum", "cocktail", "ginger beer"],
  "ingredients": [
    { "ingredient_name": "Spiced rum", "product_variant_id": 1, "quantity": "2", "unit": "oz", "sort_order": 0 },
    { "ingredient_name": "Ginger beer", "quantity": "4", "unit": "oz", "sort_order": 1 }
  ],
  "products": [
    { "product_variant_id": 1, "is_primary": true, "role": "base_spirit", "sort_order": 0 }
  ],
  "tag_ids": [3, 7]
}
```

Notes:
- `slug` is optional — when omitted it is derived from the title and made unique
  (numeric suffix under a write-tx advisory lock, same pattern as journal).
- An explicit slug that is already taken is `409 CONFLICT` — never a 500, even
  when two creates race the unique index (`23505`).
- Setting `status: "published"` without `published_at` auto-stamps the publish
  time.
- `ingredients`, `products`, and `tag_ids` are written transactionally with the
  recipe.

**Errors:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_PERMISSIONS`, `400 INVALID_JSON`,
`422 VALIDATION_ERROR`, `409 CONFLICT` (duplicate slug).

## Update a recipe

```
PATCH /admin/recipes/:id
```

All fields optional. For the relation arrays (`ingredients`, `products`,
`tag_ids`): omitting a key leaves it untouched; sending it (even empty) replaces
that relation entirely. Editing a recipe busts its public cache.

Changing `slug` to one already owned by another recipe is `409 CONFLICT`
(checked under the same advisory lock as create; unique-index races also map
to `409`, not `500`). Keeping the current slug is valid. Punctuation-only slugs
are `400 INVALID_REQUEST`.
