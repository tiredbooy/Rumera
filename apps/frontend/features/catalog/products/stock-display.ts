import { faNum } from "@/lib/products";

/**
 * Storefront stock disclosure policy (Task 076c):
 * only surface a remaining-count cue when stock is known and below 3.
 * Stock ≥ 3 (or unknown) must not show a quantity.
 */
export const LOW_STOCK_THRESHOLD = 3;

export function isLowStock(stock: number | null | undefined): boolean {
  return (
    typeof stock === "number" &&
    Number.isFinite(stock) &&
    stock > 0 &&
    stock < LOW_STOCK_THRESHOLD
  );
}

/** Persian low-stock line for PDP / shoppable cards; null when hidden. */
export function lowStockLabel(stock: number | null | undefined): string | null {
  if (!isLowStock(stock)) return null;
  return `${faNum(stock!)} عدد باقی مانده`;
}
