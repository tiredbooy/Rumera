import { describe, expect, it } from "vitest";

import { validateExternalImageURL } from "./constants";

describe("validateExternalImageURL", () => {
  it.each([
    "https://images.example/product.webp",
    "http://images.example/product.jpg?width=1200",
    "/images/products/product.webp",
  ])("accepts %s", (url) => {
    expect(validateExternalImageURL(url)).toBeNull();
  });

  it.each([
    "",
    "relative/product.webp",
    "//images.example/product.webp",
    "ftp://images.example/product.webp",
    "https://user:pass@images.example/product.webp",
    "https://images.example/product.webp#fragment",
    "/media/products/unowned.webp",
  ])("rejects %s", (url) => {
    expect(validateExternalImageURL(url)).not.toBeNull();
  });
});
