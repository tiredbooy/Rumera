import { describe, expect, it } from "vitest";

import { isLowStock, lowStockLabel } from "./stock-display";

describe("stock disclosure policy", () => {
  it("hides stock at three or above and when unknown", () => {
    expect(isLowStock(3)).toBe(false);
    expect(isLowStock(12)).toBe(false);
    expect(isLowStock(0)).toBe(false);
    expect(isLowStock(undefined)).toBe(false);
    expect(lowStockLabel(3)).toBeNull();
    expect(lowStockLabel(undefined)).toBeNull();
  });

  it("shows remaining count only when 1 or 2", () => {
    expect(isLowStock(1)).toBe(true);
    expect(isLowStock(2)).toBe(true);
    expect(lowStockLabel(2)).toContain("باقی مانده");
    expect(lowStockLabel(1)).toContain("باقی مانده");
  });
});
