import { describe, expect, it } from "vitest";

import type { ProductDetail } from "@/features/catalog/products/types";
import { productDetailLd } from "./jsonld";

describe("productDetailLd", () => {
  it("keeps stored Toman prices unchanged and publishes IRT availability per active variant", () => {
    const product: ProductDetail = {
      id: 1,
      title: "محصول نمونه",
      slug: "sample",
      is_active: true,
      variants: [
        {
          id: 1,
          sku: "inactive-sku",
          price: 999_000,
          is_active: false,
          available_stock: 8,
        },
        {
          id: 2,
          sku: "available-sku",
          price: 250_000,
          is_active: true,
          available_stock: 3,
        },
        {
          id: 3,
          sku: "sold-out-sku",
          price: 300_000,
          is_active: true,
          available_stock: 0,
        },
        {
          id: 4,
          sku: "zero-price-sku",
          price: 0,
          is_active: true,
          available_stock: 5,
        },
      ],
    };

    const data = productDetailLd(product) as Record<string, unknown>;
    const aggregate = data.offers as {
      priceCurrency: string;
      lowPrice: number;
      highPrice: number;
      offerCount: number;
      offers: Array<Record<string, unknown>>;
    };

    expect(aggregate).toMatchObject({
      priceCurrency: "IRT",
      lowPrice: 250_000,
      highPrice: 300_000,
      offerCount: 2,
    });
    expect(aggregate.offers).toEqual([
      expect.objectContaining({
        price: 250_000,
        priceCurrency: "IRT",
        sku: "available-sku",
        availability: "https://schema.org/InStock",
      }),
      expect.objectContaining({
        price: 300_000,
        priceCurrency: "IRT",
        sku: "sold-out-sku",
        availability: "https://schema.org/OutOfStock",
      }),
    ]);
    expect(data).not.toHaveProperty("sku");
    expect(JSON.stringify(data)).not.toContain("IRR");
    expect(JSON.stringify(data)).not.toContain("inactive-sku");
    expect(JSON.stringify(data)).not.toContain("zero-price-sku");
  });

  it("omits product and offer URLs when no public slug exists", () => {
    const data = productDetailLd({
      id: 1,
      title: "بدون نشانی",
      is_active: true,
      variants: [
        { id: 2, price: 125_000, is_active: true, available_stock: 1 },
      ],
    }) as Record<string, unknown>;
    const aggregate = data.offers as {
      offers: Array<Record<string, unknown>>;
    };

    expect(data).not.toHaveProperty("url");
    expect(aggregate.offers[0]).not.toHaveProperty("url");
    expect(JSON.stringify(data)).not.toContain("undefined");
  });
});
