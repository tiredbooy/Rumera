import type { BulkAddCartResult, Cart, CartSummary } from "./types";

const EMPTY_SUMMARY: CartSummary = {
  total_items: 0,
  unique_items: 0,
  subtotal: 0,
  discount_total: 0,
};

/**
 * Normalize cart payloads from the store BFF so UI never sees null items
 * (Go nil slices can still serialize as null in edge cases, and partial
 * client cache seeds must not crash list/map paths).
 */
export function normalizeCart(cart: Cart | null | undefined): Cart {
  if (!cart || typeof cart !== "object") {
    return { id: 0, items: [], summary: { ...EMPTY_SUMMARY } };
  }

  const summary = cart.summary ?? EMPTY_SUMMARY;
  return {
    id: typeof cart.id === "number" && Number.isFinite(cart.id) ? cart.id : 0,
    items: Array.isArray(cart.items) ? cart.items : [],
    summary: {
      total_items: summary.total_items ?? 0,
      unique_items: summary.unique_items ?? 0,
      subtotal: summary.subtotal ?? 0,
      discount_total: summary.discount_total ?? 0,
    },
  };
}

export function normalizeBulkAddResult(
  result: BulkAddCartResult | null | undefined,
): BulkAddCartResult {
  if (!result || typeof result !== "object") {
    return {
      cart: normalizeCart(undefined),
      added: 0,
      skipped: [],
    };
  }

  return {
    cart: normalizeCart(result.cart),
    added: typeof result.added === "number" ? result.added : 0,
    skipped: Array.isArray(result.skipped) ? result.skipped : [],
  };
}
