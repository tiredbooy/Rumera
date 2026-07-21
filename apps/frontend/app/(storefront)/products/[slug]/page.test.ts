import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allProductSlugs: vi.fn(),
  getProductBySlug: vi.fn(),
}));

vi.mock("@/features/catalog/products/api/public", () => ({
  allProductSlugs: mocks.allProductSlugs,
  getProductBySlug: mocks.getProductBySlug,
}));
vi.mock("@/features/catalog/products/components/product-detail-view", () => ({
  ProductDetailView: () => null,
}));

import { generateMetadata, generateStaticParams } from "./page";

const product = {
  id: 7,
  title: "محصول نمونه",
  is_active: true,
  images: [],
  variants: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.allProductSlugs.mockResolvedValue(["first", "second"]);
  mocks.getProductBySlug.mockResolvedValue(product);
});

describe("product detail route metadata", () => {
  it("generates every slug returned by the paginated API helper", async () => {
    await expect(generateStaticParams()).resolves.toEqual([
      { slug: "first" },
      { slug: "second" },
    ]);
  });

  it("keeps the requested canonical and default image when the payload omits a slug and images", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "requested-product" }),
    });

    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/products/requested-product",
    );
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      images: ["/opengraph-image"],
    });
    expect(JSON.stringify(metadata)).not.toContain("undefined");
  });

  it("noindexes a missing product at the requested canonical", async () => {
    mocks.getProductBySlug.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "missing-product" }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/products/missing-product",
    );
    expect(metadata.openGraph).toMatchObject({ type: "website" });
  });
});
