import { describe, expect, it } from "vitest";

import { safeCallbackUrl } from "./redirects";

describe("safeCallbackUrl", () => {
  it("preserves same-origin relative paths with query and hash", () => {
    expect(safeCallbackUrl("/products?page=2#results")).toBe(
      "/products?page=2#results",
    );
  });

  it.each([
    "https://example.com",
    "//example.com/path",
    "javascript:alert(1)",
    "data:text/html,unsafe",
  ])("rejects unsafe callback %s", (callback) => {
    expect(safeCallbackUrl(callback)).toBe("/account");
  });
});
