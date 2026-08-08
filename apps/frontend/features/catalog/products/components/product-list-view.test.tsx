import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getBrand: vi.fn(),
  getBrandBySlug: vi.fn(),
  listBrands: vi.fn(),
  listCategories: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    mocks.redirect(href);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/features/catalog/brands/api", () => ({
  getBrand: mocks.getBrand,
  getBrandBySlug: mocks.getBrandBySlug,
  listBrands: mocks.listBrands,
}));

vi.mock("@/features/catalog/categories/api", () => ({
  listCategories: mocks.listCategories,
}));

vi.mock("@/features/catalog/products/api/public", () => ({
  listProducts: mocks.listProducts,
}));

import { ProductListView } from "./product-list-view";

const brand = {
  id: 12,
  title: "Jack Daniel",
  slug: "jack-daniel",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const emptyPage = {
  results: [],
  pagination: {
    page: 1,
    limit: 12,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  },
};

describe("ProductListView brand routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProducts.mockResolvedValue(emptyPage);
    mocks.listCategories.mockResolvedValue([]);
    mocks.listBrands.mockResolvedValue({
      ...emptyPage,
      results: [brand],
    });
    mocks.getBrandBySlug.mockResolvedValue(brand);
  });

  it("sends the canonical brand slug to the product API", async () => {
    await ProductListView({
      searchParams: Promise.resolve({ brand: "jack-daniel" }),
    });

    expect(mocks.getBrandBySlug).toHaveBeenCalledWith("jack-daniel");
    expect(mocks.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ brand: "jack-daniel" }),
    );
    expect(mocks.listProducts.mock.calls[0]?.[0]).not.toHaveProperty("brand_id");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects legacy numeric brand URLs to their canonical slug", async () => {
    mocks.getBrand.mockResolvedValue(brand);

    await expect(
      ProductListView({
        searchParams: Promise.resolve({ brand_id: "12" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.getBrand).toHaveBeenCalledWith(12);
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/products?brand=jack-daniel",
    );
    expect(mocks.listProducts).not.toHaveBeenCalled();
  });
});
