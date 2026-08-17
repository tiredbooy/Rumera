import type { RecipeProductInput } from "@/features/recipes/types";

export function strOrNull(value?: string | null): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

/**
 * Ingredient rows can carry a catalogue variant. The storefront only hydrates
 * price/stock for `recipe_products`, so any ingredient link that is not already
 * in the shoppable list is appended on save.
 */
export function ensureIngredientProducts(
  ingredients: ReadonlyArray<{
    product_variant_id: number | null;
    quantity: string;
    unit: string;
  }>,
  products: readonly RecipeProductInput[],
): RecipeProductInput[] {
  const seen = new Set<number>();
  const next: RecipeProductInput[] = [];

  for (const product of products) {
    if (product.product_variant_id > 0 && !seen.has(product.product_variant_id)) {
      seen.add(product.product_variant_id);
      next.push(product);
    }
  }

  for (const ingredient of ingredients) {
    const id = ingredient.product_variant_id;
    if (id == null || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    next.push({
      product_variant_id: id,
      quantity: strOrNull(ingredient.quantity),
      unit: strOrNull(ingredient.unit),
      is_primary: false,
      sort_order: next.length,
    });
  }

  return next;
}
