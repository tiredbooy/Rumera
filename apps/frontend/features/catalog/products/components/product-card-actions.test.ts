import { describe, expect, it } from "vitest";

import { PRODUCT_CARD_ACTIONS_OVERLAY_CLASS } from "./product-card-actions";

describe("ProductCardActions visibility", () => {
  it("keeps quick-add off touch media while preserving hover and focus access", () => {
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).toContain(
      "[@media(hover:hover)_and_(pointer:fine)]:group-hover/product:opacity-100",
    );
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).toContain(
      "group-focus-within/product:opacity-100",
    );
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).not.toContain("max-sm:opacity-100");
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).not.toContain(
      "motion-reduce:opacity-100",
    );
    expect(PRODUCT_CARD_ACTIONS_OVERLAY_CLASS).toContain(
      "motion-reduce:transition-none",
    );
  });
});
