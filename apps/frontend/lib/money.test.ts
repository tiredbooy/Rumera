import { describe, expect, it } from "vitest";

import { formatDecimal, formatMoney, formatToman } from "./money";

describe("money formatting", () => {
  // D-2: the admin saw «۱۲۵٬۰۰۰٫۵ تومان» and the customer who owned the card saw
  // «۱۲۵٬۰۰۱ تومان». One card, two numbers.
  it("shows the same amount to the admin and to the customer", () => {
    expect(formatToman("125000.50")).toBe(formatMoney("125000.50", "IRT"));
    expect(formatToman("125000.50")).toBe("۱۲۵٬۰۰۰٫۵ تومان");
  });

  it("never rounds a fractional amount away", () => {
    expect(formatToman("125000.50")).not.toBe("۱۲۵٬۰۰۱ تومان");
    expect(formatToman("0.99")).toBe("۰٫۹۹ تومان");
  });

  it("keeps whole amounts free of a decimal point", () => {
    expect(formatToman(18900000)).toBe("۱۸٬۹۰۰٬۰۰۰ تومان");
    expect(formatToman("125000.00")).toBe("۱۲۵٬۰۰۰ تومان");
  });

  it("groups and localises digits, including negatives", () => {
    expect(formatDecimal("-1234567.8")).toBe("-۱٬۲۳۴٬۵۶۷٫۸");
    expect(formatDecimal("999")).toBe("۹۹۹");
  });

  it("carries a non-Toman currency code through", () => {
    expect(formatMoney("42.5", "usd")).toBe("۴۲٫۵ USD");
  });

  it("falls back rather than inventing a number", () => {
    expect(formatDecimal("abc")).toBeNull();
    expect(formatDecimal(Number.NaN)).toBeNull();
    expect(formatMoney("abc", "IRT")).toBe("abc");
    expect(formatMoney("abc", "USD")).toBe("abc");
  });
});
