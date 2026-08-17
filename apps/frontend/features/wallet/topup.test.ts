import { describe, expect, it } from "vitest";

import {
  isValidTopUpAmount,
  usablePaymentUrl,
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

describe("usablePaymentUrl (PR-030c)", () => {
  it("returns a non-empty API url as-is after trim", () => {
    const href = "https://pay.example.com/start?transaction_id=wtop-abc";
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
