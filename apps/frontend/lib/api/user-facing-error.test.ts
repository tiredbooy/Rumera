import { describe, expect, it } from "vitest";

import { ApiError } from "./errors";
import { ApiClientError } from "./store-client";
import {
  apiErrorMessage,
  describeApiError,
  extractApiError,
} from "./user-facing-error";

describe("describeApiError (PH-012d)", () => {
  it("maps OUT_OF_STOCK to specific Persian, not generic fallback", () => {
    const d = describeApiError(
      new ApiClientError(409, "OUT_OF_STOCK", "not enough stock available"),
      { fallback: "something went wrong" },
    );
    expect(d.code).toBe("OUT_OF_STOCK");
    expect(d.title).toMatch(/موجودی/);
    expect(d.title).not.toBe("something went wrong");
    expect(d.title.toLowerCase()).not.toContain("something went wrong");
  });

  it("maps INSUFFICIENT_FUNDS and INSUFFICIENT_POINTS distinctly", () => {
    const funds = describeApiError(
      new ApiClientError(409, "INSUFFICIENT_FUNDS", "insufficient wallet balance"),
    );
    const points = describeApiError(
      new ApiClientError(409, "INSUFFICIENT_POINTS", "insufficient loyalty points"),
    );
    expect(funds.title).toMatch(/کیف پول|موجودی/);
    expect(points.title).toMatch(/امتیاز/);
    expect(funds.title).not.toBe(points.title);
  });

  it("maps GIFT_CARD_INVALID", () => {
    const d = describeApiError(
      new ApiClientError(404, "GIFT_CARD_INVALID", "gift card code is invalid"),
    );
    expect(d.title).toMatch(/کارت هدیه|کد/);
  });

  it("maps forbidden / insufficient permissions for admin", () => {
    const d = describeApiError(
      new ApiError(403, "INSUFFICIENT_PERMISSIONS", "insufficient permissions"),
    );
    expect(d.title).toMatch(/مجوز|اجازه/);
  });

  it("uses Persian server message when no code map", () => {
    const d = describeApiError(
      new ApiClientError(400, "WEIRD_CODE", "لطفاً آدرس را کامل کنید"),
    );
    expect(d.title).toBe("لطفاً آدرس را کامل کنید");
  });

  it("falls back only when code unknown and message empty/generic", () => {
    const d = describeApiError(
      new ApiClientError(500, "INTERNAL_ERROR", "an unexpected error occurred"),
      { fallback: "خطای پیش‌فرض تست" },
    );
    // INTERNAL_ERROR is mapped — not the raw fallback alone.
    expect(d.title).toMatch(/غیرمنتظره|خطا/);
    const bare = describeApiError(new Error(""), {
      fallback: "خطای پیش‌فرض تست",
    });
    expect(bare.title).toBe("خطای پیش‌فرض تست");
  });

  it("preserves validation field errors", () => {
    const d = describeApiError(
      new ApiError(422, "VALIDATION_ERROR", "validation failed", {
        email: ["must be valid"],
      }),
    );
    expect(d.fieldErrors?.email).toEqual(["must be valid"]);
    expect(d.title).toMatch(/نامعتبر|اطلاعات/);
  });

  it("apiErrorMessage returns mapped title", () => {
    const msg = apiErrorMessage(
      new ApiClientError(409, "OUT_OF_STOCK", "x"),
      "generic",
    );
    expect(msg).toBe("موجودی کافی نیست");
  });
});

describe("extractApiError", () => {
  it("reads duck-typed feature errors", () => {
    class CustomErr extends Error {
      status = 403;
      code = "FORBIDDEN";
      constructor() {
        super("nope");
        this.name = "CustomErr";
      }
    }
    expect(extractApiError(new CustomErr())).toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "nope",
    });
  });
});
