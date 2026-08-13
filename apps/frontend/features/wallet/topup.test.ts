import { describe, expect, it } from "vitest";

import {
  isValidTopUpAmount,
  WALLET_TOPUP_MAX,
  WALLET_TOPUP_MIN,
  WALLET_TOPUP_PRESETS,
} from "./types";

describe("wallet top-up amounts (PH-041b)", () => {
  it("accepts bounds and presets", () => {
    expect(isValidTopUpAmount(WALLET_TOPUP_MIN)).toBe(true);
    expect(isValidTopUpAmount(WALLET_TOPUP_MAX)).toBe(true);
    for (const p of WALLET_TOPUP_PRESETS) {
      expect(isValidTopUpAmount(p)).toBe(true);
    }
  });

  it("rejects free/out-of-range amounts", () => {
    expect(isValidTopUpAmount(0)).toBe(false);
    expect(isValidTopUpAmount(WALLET_TOPUP_MIN - 1)).toBe(false);
    expect(isValidTopUpAmount(WALLET_TOPUP_MAX + 1)).toBe(false);
    expect(isValidTopUpAmount(Number.NaN)).toBe(false);
  });
});
