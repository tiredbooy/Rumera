import { describe, expect, it } from "vitest";

import { couponMoneyHint, summarizeCouponOffer } from "./coupon-offer";

describe("summarizeCouponOffer", () => {
  it("builds the percentage / cap / minimum sentence", () => {
    expect(
      summarizeCouponOffer({
        discountType: "percentage",
        discountValue: "10",
        maxDiscountAmount: "50000",
        minOrderAmount: "500000",
      }),
    ).toBe("۱۰٪ تخفیف تا سقف ۵۰٬۰۰۰ تومان برای سفارش‌های بالای ۵۰۰٬۰۰۰ تومان");
  });

  it("describes fixed and free-shipping offers", () => {
    expect(
      summarizeCouponOffer({
        discountType: "fixed_amount",
        discountValue: "20000",
        maxDiscountAmount: "",
        minOrderAmount: "0",
      }),
    ).toBe("۲۰٬۰۰۰ تومان تخفیف");
    expect(
      summarizeCouponOffer({
        discountType: "free_shipping",
        discountValue: "0",
        maxDiscountAmount: "",
        minOrderAmount: "150000",
      }),
    ).toBe("ارسال رایگان برای سفارش‌های بالای ۱۵۰٬۰۰۰ تومان");
  });
});

describe("couponMoneyHint", () => {
  it("groups a live amount in Tomans", () => {
    expect(couponMoneyHint("500000")).toBe("۵۰۰٬۰۰۰ تومان");
    expect(couponMoneyHint("")).toBeNull();
  });
});
