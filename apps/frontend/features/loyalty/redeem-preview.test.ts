import { describe, expect, it } from "vitest";

import { hasRedeemRate, redeemPreviewToman } from "./redeem-preview";

describe("redeemPreviewToman (PR-003l)", () => {
  it("uses the live 500 Toman/point rate", () => {
    expect(redeemPreviewToman(2, 500)).toBe(1000);
    expect(redeemPreviewToman(3, 500)).toBe(1500);
  });

  it("uses 2000 Toman/point when that is the programme rate", () => {
    expect(redeemPreviewToman(4, 2000)).toBe(8000);
  });

  it("does not invent 1000 when the rate is missing or non-positive", () => {
    expect(redeemPreviewToman(2, undefined)).toBeNull();
    expect(redeemPreviewToman(2, null)).toBeNull();
    expect(redeemPreviewToman(2, 0)).toBeNull();
    expect(redeemPreviewToman(2, -500)).toBeNull();
    expect(redeemPreviewToman(2, Number.NaN)).toBeNull();
  });

  it("returns null for non-positive points even when the rate is live", () => {
    expect(redeemPreviewToman(0, 500)).toBeNull();
    expect(redeemPreviewToman(-1, 500)).toBeNull();
    expect(redeemPreviewToman(Number.NaN, 500)).toBeNull();
  });
});

describe("hasRedeemRate (PR-003l)", () => {
  it("accepts a positive finite rate only", () => {
    expect(hasRedeemRate(500)).toBe(true);
    expect(hasRedeemRate(1000)).toBe(true);
    expect(hasRedeemRate(0)).toBe(false);
    expect(hasRedeemRate(undefined)).toBe(false);
    expect(hasRedeemRate(null)).toBe(false);
  });
});
