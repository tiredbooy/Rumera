import { describe, expect, it } from "vitest";

import {
  MAX_INVENTORY_INTEGER,
  MIN_INVENTORY_INTEGER,
  parseStockAdjustment,
  reorderThresholdSchema,
  toAsciiInventoryDigits,
  toReorderThresholdInput,
} from "./validations";

describe("inventory validation", () => {
  it("normalizes Persian and Arabic digits without changing ASCII input", () => {
    expect(toAsciiInventoryDigits("۱۲۳٤٥6")).toBe("123456");
  });

  it("accepts bounded nonnegative integer thresholds and maps their payload", () => {
    const result = reorderThresholdSchema.safeParse({
      reorder_point: "۱۲",
      reorder_quantity: "٣٠",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(toReorderThresholdInput(result.data)).toEqual({
        reorder_point: 12,
        reorder_quantity: 30,
      });
    }
  });

  it("accepts signed deltas and rejects zero, decimals, blanks, and overflow", () => {
    for (const value of [
      "",
      "0",
      "1.5",
      String(MAX_INVENTORY_INTEGER + 1),
      String(MIN_INVENTORY_INTEGER - 1),
    ]) {
      expect(parseStockAdjustment(value)).toBeNull();
    }
    expect(parseStockAdjustment("−۳")).toBe(-3);
    expect(parseStockAdjustment("۲")).toBe(2);
    expect(parseStockAdjustment(String(MAX_INVENTORY_INTEGER))).toBe(
      MAX_INVENTORY_INTEGER,
    );
  });
});
