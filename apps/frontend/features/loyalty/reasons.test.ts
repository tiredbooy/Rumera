import { describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEW_BONUS_POINTS,
  loyaltyReasonLabel,
  LOYALTY_REASON_FA,
} from "./reasons";

describe("loyalty reasons (PH-040c)", () => {
  it("maps known earn reasons to Persian", () => {
    expect(loyaltyReasonLabel("review")).toBe(LOYALTY_REASON_FA.review);
    expect(loyaltyReasonLabel("birthday")).toBe(LOYALTY_REASON_FA.birthday);
    expect(loyaltyReasonLabel("order_paid")).toBe(LOYALTY_REASON_FA.order_paid);
  });

  it("falls back to raw reason for unknowns", () => {
    expect(loyaltyReasonLabel("future_reason")).toBe("future_reason");
  });

  it("keeps review bonus default aligned with backend default", () => {
    expect(DEFAULT_REVIEW_BONUS_POINTS).toBe(50);
  });
});
