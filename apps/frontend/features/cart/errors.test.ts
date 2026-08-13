import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api/store-client";

import { cartMutationErrorMessage } from "./errors";

describe("cartMutationErrorMessage", () => {
  it("maps known commerce error codes to Persian copy", () => {
    expect(
      cartMutationErrorMessage(new ApiClientError(409, "OUT_OF_STOCK", "x")),
    ).toBe("موجودی کافی نیست");
    expect(
      cartMutationErrorMessage(
        new ApiClientError(401, "SESSION_EXPIRED", "sign in"),
      ),
    ).toMatch(/نشست/);
    expect(
      cartMutationErrorMessage(
        new ApiClientError(404, "PRODUCT_NOT_FOUND", "missing"),
      ),
    ).toBe("این محصول دیگر در دسترس نیست");
  });

  it("falls back for unknown errors", () => {
    expect(cartMutationErrorMessage(new Error("boom"))).toBe(
      "افزودن به سبد ناموفق بود",
    );
  });

  it("surfaces specific OUT_OF_STOCK copy not a generic-only failure", () => {
    const msg = cartMutationErrorMessage(
      new ApiClientError(409, "OUT_OF_STOCK", "not enough stock available"),
    );
    expect(msg).toMatch(/موجودی/);
    expect(msg).not.toBe("افزودن به سبد ناموفق بود");
  });
});
