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
    ).toBe("نشست شما منقضی شده؛ دوباره وارد شوید");
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
});
