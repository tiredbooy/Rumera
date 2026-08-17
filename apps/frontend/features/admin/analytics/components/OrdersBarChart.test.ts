import { describe, expect, it } from "vitest";

import { formatOrdersTooltip } from "./OrdersBarChart";

describe("formatOrdersTooltip", () => {
  it("formats the day and Persian order count", () => {
    expect(formatOrdersTooltip("۱۲ مرد", 12)).toBe("۱۲ مرد: ۱۲ سفارش");
  });
});
