import { describe, expect, it } from "vitest";

import { validateImageURL } from "./constants";

describe("validateImageURL", () => {
  it.each([
    "https://images.example/product.webp",
    "/images/products/product.webp",
  ])("accepts %s", (url) => {
    expect(validateImageURL(url)).toBeNull();
  });

  it.each([
    "",
    "relative/product.webp",
    "//images.example/product.webp",
    "ftp://images.example/product.webp",
    "http://images.example/product.webp",
    "https://user:pass@images.example/product.webp",
    "https://images.example/product.webp#fragment",
    "/\\images.example/product.webp",
    "/media/products/unowned.webp",
  ])("rejects %s", (url) => {
    expect(validateImageURL(url)).not.toBeNull();
  });

  it("allows only an explicitly trusted existing canonical media path", () => {
    const path = "/media/recipes/9/cover.webp";
    expect(validateImageURL(path)).not.toBeNull();
    expect(validateImageURL(path, { allowMediaPath: true })).toBeNull();
  });
});
