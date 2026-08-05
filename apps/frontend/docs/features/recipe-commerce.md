# Recipe → commerce journey (Task 061g)

## Goal

Readers should move from **learning a recipe** to **buying the right bottles**
without ambiguity: each linked ingredient maps to a live variant, quantity,
availability, and a useful alternative when stock is gone.

## Data model (backend)

| Source | Role |
|--------|------|
| `recipe_ingredients` | Editorial list (`ingredient_name`, qty, unit, optional) + optional `product_variant_id` |
| `recipe_products` | Curated shoppable set (primary, role, qty for the recipe) |
| `GetShoppableProducts` | Joins variants → products → inventory → image |

**Availability** (updated 061g): active product + active variant + sellable stock
`> 0`. Zero price is allowed (truthful free/zero SKUs).

## Frontend projection

```
linkIngredientsToCommerce(ingredients, products)
  → CommerceIngredient[]  // linked shoppable row or search alternative
```

- Ingredient list: «خرید این ماده» scrolls to `#recipe-product-{variantId}`
- Unlinked: «جستجو در فروشگاه» → `/search?q=…`
- Unavailable linked: «یافتن جایگزین» → search by product title
- Shoppable cards: add-to-cart, stock count, PDP link, alternative CTA
- «افزودن همهٔ مواد»: bulk cart with partial-success toasts (existing BFF)

## Mobile-first UI

- Ingredient actions ≥ 44px hit targets
- Sticky jump to shop section on small screens
- Shop grid: 1 → 2 → 3 columns (`sm` / `lg`)
- Cards use `scroll-mt` for in-page anchors under the sticky header

## Tests

```bash
cd apps/frontend && npx vitest run features/recipes/commerce.test.ts features/recipes/components/shoppable-product-card.test.tsx
cd apps/backend && go test ./internal/repositories/ -count=1
```

## Out of scope / future

- Server-side “substitute SKU” graph (would need new product relations)
- Auto-scaling cart qty from recipe servings (qty stays 1 unit per add; recipe measure is informational)
