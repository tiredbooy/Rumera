import { describe, expect, it } from "vitest";

import {
  mediaPolicyFor,
  resolveStorefrontMediaSource,
  storageKeyFromMediaUrl,
} from "./storefront-policy";

describe("storefront media policy", () => {
  it("defines product-card ladder and sizes for responsive cards", () => {
    const policy = mediaPolicyFor("product-card");
    expect(policy.widths).toEqual([320, 480, 640, 800]);
    expect(policy.height).toBe(600);
    expect(policy.width / (policy.height ?? 1)).toBeCloseTo(4 / 3, 5);
    expect(policy.fit).toBe("cover");
    expect(policy.sizes).toContain("100vw");
    expect(policy.format).toBe("webp");
  });

  it("matches recommendation image sizing to the wide rail breakpoints", () => {
    const policy = mediaPolicyFor("recommendation");
    expect(policy.widths).toEqual([280, 400, 560, 720]);
    expect(policy.height).toBe(540);
    expect(policy.sizes).toContain("calc(100vw - 4.5rem)");
    expect(policy.sizes).toContain("21.5rem");
    expect(policy.sizes).toContain("22.5rem");
  });

  it("extracts storage keys from relative and absolute media URLs", () => {
    expect(storageKeyFromMediaUrl("/media/products/12/cover.webp")).toBe(
      "products/12/cover.webp",
    );
    expect(
      storageKeyFromMediaUrl("http://localhost:8080/media/recipes/a.webp"),
    ).toBe("recipes/a.webp");
    expect(storageKeyFromMediaUrl("https://cdn.example.com/other.jpg")).toBe(
      null,
    );
    expect(storageKeyFromMediaUrl(null)).toBe(null);
  });

  it("prefers explicit storage keys and falls back to URL derivation", () => {
    expect(
      resolveStorefrontMediaSource({
        storageKey: "products/1.webp",
        src: "/media/other.webp",
      }),
    ).toEqual({ imageKey: "products/1.webp", src: "/media/other.webp" });

    expect(
      resolveStorefrontMediaSource({
        src: "/media/categories/x.webp",
      }),
    ).toEqual({ imageKey: "categories/x.webp", src: "/media/categories/x.webp" });

    expect(
      resolveStorefrontMediaSource({
        src: "https://cdn.example.com/static/hero.jpg",
      }),
    ).toEqual({
      imageKey: null,
      src: "https://cdn.example.com/static/hero.jpg",
    });
  });
});
