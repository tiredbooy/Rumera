import { describe, expect, it } from "vitest";

import { giftCardIssuanceSchema, toCreateGiftCardsInput } from "./validations";

describe("gift-card issuance validation", () => {
  it("preserves the exact decimal string and integer count", () => {
    const values = giftCardIssuanceSchema.parse({
      amount: "125000.50",
      count: "12",
    });
    expect(toCreateGiftCardsInput(values)).toEqual({
      amount: "125000.50",
      count: 12,
    });
  });

  it.each([
    [{ amount: "0", count: "1" }, "zero amount"],
    [{ amount: "10.001", count: "1" }, "excess precision"],
    [{ amount: "1000000000000000000", count: "1" }, "database overflow"],
    [{ amount: "10", count: "0" }, "zero count"],
    [{ amount: "10", count: "501" }, "oversized batch"],
    [{ amount: "10", count: "1.5" }, "fractional count"],
  ])("rejects %s (%s)", (input) => {
    expect(giftCardIssuanceSchema.safeParse(input).success).toBe(false);
  });
});
