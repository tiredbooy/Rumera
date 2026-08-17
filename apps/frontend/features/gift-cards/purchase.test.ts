import { describe, expect, it } from "vitest";

import {
  GIFT_CARD_PURCHASE_MAX,
  GIFT_CARD_PURCHASE_MIN,
  GIFT_CARD_PURCHASE_PRESETS,
  isValidGiftCardPurchaseAmount,
  usablePaymentUrl,
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

describe("usablePaymentUrl (PR-030c)", () => {
  it("returns a non-empty API url as-is after trim", () => {
    const href = "https://pay.example.com/start?transaction_id=gbuy-xyz";
    expect(usablePaymentUrl(href)).toBe(href);
    expect(usablePaymentUrl(`  ${href}  `)).toBe(href);
  });

  it("does not invent a url when the field is missing or blank", () => {
    expect(usablePaymentUrl(undefined)).toBeUndefined();
    expect(usablePaymentUrl(null)).toBeUndefined();
    expect(usablePaymentUrl("")).toBeUndefined();
    expect(usablePaymentUrl("   ")).toBeUndefined();
  });
});
