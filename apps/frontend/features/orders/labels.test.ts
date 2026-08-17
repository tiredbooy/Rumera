import { describe, expect, it } from "vitest";

import {
  canStartOrderPay,
  isCancellable,
  isPayable,
  orderPayCtaLabel,
  usablePaymentUrl,
} from "./labels";

describe("order pay / cancel labels (PR-033b)", () => {
  it("treats pending and payment_failed as cancellable and payable", () => {
    expect(isCancellable("pending")).toBe(true);
    expect(isCancellable("payment_failed")).toBe(true);
    expect(isPayable("pending")).toBe(true);
    expect(isPayable("payment_failed")).toBe(true);
    expect(isCancellable("paid")).toBe(false);
    expect(isPayable("delivered")).toBe(false);
  });

  it("refuses wallet for POST /orders/:id/pay", () => {
    expect(
      canStartOrderPay({ status: "pending", payment_method: "wallet" }),
    ).toBe(false);
    expect(
      canStartOrderPay({ status: "payment_failed", payment_method: "gateway" }),
    ).toBe(true);
    expect(
      canStartOrderPay({ status: "paid", payment_method: "gateway" }),
    ).toBe(false);
  });

  it("uses پرداخت مجدد only after a failed attempt", () => {
    expect(orderPayCtaLabel("payment_failed")).toBe("پرداخت مجدد");
    expect(orderPayCtaLabel("pending")).toBe("ادامه پرداخت");
  });

  it("does not invent a start URL from blanks or a transaction id", () => {
    const href = "https://pay.example.com/start?transaction_id=abc";
    expect(usablePaymentUrl(href)).toBe(href);
    expect(usablePaymentUrl(`  ${href}  `)).toBe(href);
    expect(usablePaymentUrl(undefined)).toBeUndefined();
    expect(usablePaymentUrl(null)).toBeUndefined();
    expect(usablePaymentUrl("")).toBeUndefined();
    expect(usablePaymentUrl("   ")).toBeUndefined();
  });
});
