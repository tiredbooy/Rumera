import { describe, expect, it } from "vitest";

import {
  couponFormDefaults,
  couponFormSchema,
  MAX_COUPON_MONEY,
  MAX_COUPON_USES,
  parseIDList,
  toCreateCouponInput,
  toUpdateCouponInput,
} from "./validations";

describe("coupon form validation", () => {
  it("rejects invalid discount and usage combinations", () => {
    const values = couponFormDefaults();
    expect(
      couponFormSchema.safeParse({
        ...values,
        code: "OVER",
        discount_value: "101",
      }).success,
    ).toBe(false);
    expect(
      couponFormSchema.safeParse({
        ...values,
        code: "FIXED",
        discount_type: "fixed_amount",
        discount_value: "10",
        max_discount_amount: "5",
      }).success,
    ).toBe(false);
    expect(
      couponFormSchema.safeParse({
        ...values,
        code: "LIMIT",
        discount_value: "10",
        max_uses: "2",
        max_uses_per_user: "3",
      }).success,
    ).toBe(false);
  });

  it("requires valid applicability and date ranges", () => {
    const values = couponFormDefaults();
    expect(
      couponFormSchema.safeParse({
        ...values,
        code: "EMPTY",
        applicability: "specific",
      }).success,
    ).toBe(false);
    expect(
      couponFormSchema.safeParse({
        ...values,
        code: "DATES",
        starts_at: "2026-07-18T12:00",
        expires_at: "2026-07-18T11:59",
      }).success,
    ).toBe(false);
    expect(parseIDList("2, 2، 7")).toEqual([2, 7]);
  });

  it("rejects values that exceed the database column bounds", () => {
    const values = couponFormDefaults();
    const invalidValues = [
      {
        ...values,
        code: "FIXED-OVERFLOW",
        discount_type: "fixed_amount" as const,
        discount_value: String(MAX_COUPON_MONEY + 0.01),
      },
      {
        ...values,
        code: "ORDER-OVERFLOW",
        min_order_amount: String(MAX_COUPON_MONEY + 0.01),
      },
      {
        ...values,
        code: "USES-OVERFLOW",
        max_uses: String(MAX_COUPON_USES + 1),
      },
      {
        ...values,
        code: "DECIMAL-SCALE",
        discount_type: "fixed_amount" as const,
        discount_value: "0.001",
      },
      {
        ...values,
        code: "HIDDEN-DECIMAL-SCALE",
        discount_type: "fixed_amount" as const,
        discount_value: "1.000000000001",
      },
    ];

    for (const value of invalidValues) {
      expect(couponFormSchema.safeParse(value).success).toBe(false);
    }

    expect(
      couponFormSchema.safeParse({
        ...values,
        code: "LARGE-VALID",
        discount_type: "fixed_amount",
        discount_value: "74685263.71",
      }).success,
    ).toBe(true);
  });

  it("maps create and update payloads with intentional null clearing", () => {
    const values = {
      ...couponFormDefaults(),
      code: " summer ",
      discount_value: "20",
      max_discount_amount: "100000",
      max_uses: "50",
      max_uses_per_user: "2",
      applicability: "specific" as const,
      product_ids: "5, 8, 5",
      category_ids: "3",
    };
    expect(couponFormSchema.safeParse(values).success).toBe(true);
    expect(toCreateCouponInput(values)).toMatchObject({
      code: "SUMMER",
      discount_value: 20,
      max_discount_amount: 100000,
      max_uses: 50,
      max_uses_per_user: 2,
      applicable_to: { product_ids: [5, 8], category_ids: [3] },
    });

    const update = toUpdateCouponInput({
      ...values,
      max_discount_amount: "",
      max_uses: "",
      applicability: "all",
      expires_at: "",
    });
    expect(update.max_discount_amount).toBeNull();
    expect(update.max_uses).toBeNull();
    expect(update.applicable_to).toBeNull();
    expect(update.expires_at).toBeNull();
  });

  it("omits untouched timestamps from edit payloads", () => {
    const coupon = {
      id: 7,
      code: "SAVE",
      description: "old",
      discount_type: "percentage" as const,
      discount_value: 10,
      min_order_amount: 0,
      max_uses_per_user: 1,
      is_active: true,
      starts_at: "2026-07-18T10:15:45.987Z",
      expires_at: "2026-07-19T11:16:46.123Z",
      total_uses: 4,
      is_exhausted: false,
    };
    const values = { ...couponFormDefaults(coupon), description: "new" };

    expect(toUpdateCouponInput(values, coupon)).toEqual({ description: "new" });
  });
});
