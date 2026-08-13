import { describe, expect, it } from "vitest";

import { packageWeightKg } from "./package-weight";

describe("packageWeightKg (PH-020c)", () => {
  it("sums positive unit weights × quantity", () => {
    expect(
      packageWeightKg([
        { quantity: 2, weight_kg: 1.5 },
        { quantity: 1, weight_kg: 0.5 },
      ]),
    ).toBe(3.5);
  });

  it("treats missing or non-positive weight as 0", () => {
    expect(
      packageWeightKg([
        { quantity: 3, weight_kg: null },
        { quantity: 2 },
        { quantity: 1, weight_kg: 0 },
        { quantity: 1, weight_kg: -1 },
      ]),
    ).toBe(0);
  });

  it("returns 0 for empty cart", () => {
    expect(packageWeightKg(undefined)).toBe(0);
    expect(packageWeightKg([])).toBe(0);
  });

  it("ignores non-positive quantity lines", () => {
    expect(
      packageWeightKg([
        { quantity: 0, weight_kg: 10 },
        { quantity: -1, weight_kg: 10 },
        { quantity: 2, weight_kg: 1 },
      ]),
    ).toBe(2);
  });
});
