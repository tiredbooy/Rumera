import type { ProductListItem } from "@/features/catalog/products/types";

/**
 * Public PDP href for a catalogue product. Missing/blank slugs must never
 * produce `/products/undefined` or similar dead links.
 */
export function productPublicHref(
  product: Pick<ProductListItem, "slug"> | { slug?: string | null },
): string | null {
  const slug = product.slug?.trim();
  if (!slug) return null;
  return `/products/${encodeURIComponent(slug)}`;
}

export type CatalogueAvailability =
  | { kind: "ready"; label: "آمادهٔ سفارش" }
  | { kind: "out_of_stock"; label: "ناموجود" }
  | { kind: "unconfigured"; label: "در حال تأمین" };

/**
 * Availability chip for list projections. Stock beats configuration: an
 * active-but-empty catalogue row is "ناموجود", not "در حال تأمین".
 */
export function catalogueAvailability(
  product: Pick<
    ProductListItem,
    "active_variant_count" | "available_variant_count"
  >,
): CatalogueAvailability {
  if (product.available_variant_count > 0) {
    return { kind: "ready", label: "آمادهٔ سفارش" };
  }
  if (product.active_variant_count > 0) {
    return { kind: "out_of_stock", label: "ناموجود" };
  }
  return { kind: "unconfigured", label: "در حال تأمین" };
}

export type CataloguePriceDisplay =
  | { kind: "single"; amount: number; ranged: false }
  | { kind: "range"; amount: number; max: number; ranged: true }
  | { kind: "unconfigured" }
  | { kind: "out_of_stock_unpriced" };

/**
 * Price band presentation for list cards.
 *
 * - No active variants → unconfigured (not a fake 0 price).
 * - Active variants with min_price ≥ 0 → show the real band, including 0.
 *   Zero is a truthful free/unset monetary value once a variant exists; it is
 *   not treated as "missing" so quick-commerce eligibility can stay stock-based.
 */
export function cataloguePriceDisplay(
  product: Pick<
    ProductListItem,
    "min_price" | "max_price" | "active_variant_count"
  >,
): CataloguePriceDisplay {
  if (product.active_variant_count <= 0) {
    return { kind: "unconfigured" };
  }
  const min = product.min_price;
  const max = product.max_price;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { kind: "out_of_stock_unpriced" };
  }
  if (max > min) {
    return { kind: "range", amount: min, max, ranged: true };
  }
  return { kind: "single", amount: min, ranged: false };
}

/**
 * Quick-add is only valid when the list projection already resolved a single
 * in-stock active variant. Multi-option / OOS / unconfigured rows must not
 * invent a cart target.
 */
export function isQuickPurchasable(
  product: Pick<ProductListItem, "purchasable_variant_id">,
): product is ProductListItem & { purchasable_variant_id: number } {
  return (
    typeof product.purchasable_variant_id === "number" &&
    Number.isFinite(product.purchasable_variant_id) &&
    product.purchasable_variant_id > 0
  );
}
