import type {
  RecipeIngredient,
  ShoppableProduct,
} from "@/features/recipes/types";

/**
 * Ingredient row enriched with live shoppable catalogue data when the recipe
 * links a product_variant_id. Pure projection — no invented inventory.
 */
export type CommerceIngredient = RecipeIngredient & {
  linked: ShoppableProduct | null;
  /** Anchor into the shop section when a product is linked. */
  shopAnchor: string | null;
  /** Search fallback when the linked product is missing or sold out. */
  alternativeHref: string;
};

export function shopSectionId(): string {
  return "recipe-shop";
}

export function productShopAnchor(variantId: number): string {
  return `recipe-product-${variantId}`;
}

/** Catalog search for a free-text or unavailable ingredient. */
export function alternativeSearchHref(query: string): string {
  const q = query.trim();
  if (!q) return "/products";
  return `/search?q=${encodeURIComponent(q)}`;
}

/**
 * Join recipe ingredients to shoppable products by variant id.
 * Unlinked ingredients stay editorial-only with a search alternative.
 */
export function linkIngredientsToCommerce(
  ingredients: RecipeIngredient[],
  products: ShoppableProduct[],
): CommerceIngredient[] {
  const byVariant = new Map<number, ShoppableProduct>();
  for (const product of products) {
    byVariant.set(product.product_variant_id, product);
  }

  return ingredients.map((ingredient) => {
    const variantId = ingredient.product_variant_id;
    const linked =
      variantId != null && Number.isFinite(variantId)
        ? (byVariant.get(variantId) ?? null)
        : null;

    return {
      ...ingredient,
      linked,
      shopAnchor: linked
        ? productShopAnchor(linked.product_variant_id)
        : null,
      alternativeHref: alternativeSearchHref(
        linked?.product_title ?? ingredient.ingredient_name,
      ),
    };
  });
}

export function availableShoppableProducts(
  products: ShoppableProduct[],
): ShoppableProduct[] {
  return products.filter((product) => product.is_available);
}

export function productDetailHref(
  product: Pick<ShoppableProduct, "product_slug">,
): string | null {
  const slug = product.product_slug?.trim();
  if (!slug) return null;
  return `/products/${encodeURIComponent(slug)}`;
}
