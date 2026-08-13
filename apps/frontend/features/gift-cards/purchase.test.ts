import { describe, expect, it } from "vitest";

import {
  GIFT_CARD_PURCHASE_MAX,
  GIFT_CARD_PURCHASE_MIN,
  GIFT_CARD_PURCHASE_PRESETS,
  isValidGiftCardPurchaseAmount,
} from "./types";

describe("gift-card purchase amounts (PH-042b)", () => {
  it("accepts bounds and presets", () => {
    expect(isValidGiftCardPurchaseAmount(GIFT_CARD_PURCHASE_MIN)).toBe(true);
    expect(isValidGiftCardPurchaseAmount(GIFT_CARD_PURCHASE_MAX)).toBe(true);
    for (const p of GIFT_CARD_PURCHASE_PRESETS) {
      expect(isValidGiftCardPurchaseAmount(p)).toBe(true);
    }
  });

  it("rejects free/out-of-range amounts", () => {
    expect(isValidGiftCardPurchaseAmount(0)).toBe(false);
    expect(isValidGiftCardPurchaseAmount(GIFT_CARD_PURCHASE_MIN - 1)).toBe(
      false,
    );
    expect(isValidGiftCardPurchaseAmount(GIFT_CARD_PURCHASE_MAX + 1)).toBe(
      false,
    );
    expect(isValidGiftCardPurchaseAmount(Number.NaN)).toBe(false);
  });
});
