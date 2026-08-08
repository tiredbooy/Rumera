import { describe, expect, it } from "vitest";

import { normalizeBulkAddResult, normalizeCart } from "./normalize";
import type { Cart } from "./types";

describe("normalizeCart", () => {
  it("fills missing items and summary for partial payloads", () => {
    const cart = normalizeCart({ id: 7 } as Cart);
    expect(cart.id).toBe(7);
    expect(cart.items).toEqual([]);
    expect(cart.summary.total_items).toBe(0);
    expect(cart.summary.unique_items).toBe(0);
  });

  it("preserves real lines when present", () => {
    const cart = normalizeCart({
      id: 1,
      items: [
        {
          id: 9,
          product_id: 3,
          product_title: "بطری",
          variant_id: 4,
          current_price: 10,
          price_changed: false,
          quantity: 2,
          line_total: 20,
        },
      ],
      summary: {
        total_items: 2,
        unique_items: 1,
        subtotal: 20,
        discount_total: 0,
      },
    });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.variant_id).toBe(4);
    expect(cart.summary.subtotal).toBe(20);
  });

  it("handles nullish input safely", () => {
    expect(normalizeCart(null).items).toEqual([]);
    expect(normalizeCart(undefined).id).toBe(0);
  });
});

describe("normalizeBulkAddResult", () => {
  it("normalizes nested cart and skip list", () => {
    const result = normalizeBulkAddResult({
      cart: { id: 2 } as Cart,
      added: 1,
      skipped: undefined as unknown as [],
    });
    expect(result.cart.items).toEqual([]);
    expect(result.added).toBe(1);
    expect(result.skipped).toEqual([]);
  });
});
