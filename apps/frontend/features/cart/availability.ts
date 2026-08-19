import type { Cart, CartItem } from "./types";

/**
 * Per-line availability (U-3). `available_stock` is projected by the cart
 * endpoints from the same `stock_on_hand - committed_stock` the order reserve
 * path enforces, so a line the cart calls unorderable is exactly a line that
 * would be rejected at «ثبت و پرداخت».
 *
 * The number is always read from the server payload — never from client state —
 * so the quantity cap cannot drift above what is really sellable.
 */

/** Sellable stock for the line; `null` when the payload predates the field. */
export function lineAvailableStock(item: CartItem): number | null {
  const stock = item.available_stock;
  if (typeof stock !== "number" || !Number.isFinite(stock)) return null;
  return Math.max(0, Math.trunc(stock));
}

/** True when the line's quantity is above what can actually be ordered. */
export function isLineUnorderable(item: CartItem): boolean {
  const available = lineAvailableStock(item);
  return available !== null && item.quantity > available;
}

/** True when at least one line would fail at checkout as the cart stands. */
export function hasUnorderableLine(cart: Cart | null | undefined): boolean {
  // Partial client cache seeds can arrive without `items` (see normalize.ts).
  return Array.isArray(cart?.items) && cart.items.some(isLineUnorderable);
}
