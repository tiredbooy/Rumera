import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ view: vi.fn(() => null) }));

vi.mock("@/features/catalog/products/components/product-list-view", () => ({
  ProductListView: mocks.view,
}));

import ProductsPage, { generateMetadata } from "./page";

describe("product list route", () => {
  it("forwards the promised Next 16 search params", () => {
    const searchParams = Promise.resolve({ page: ["2", "3"] });
    const element = ProductsPage({ searchParams });
    expect(element.props.searchParams).toBe(searchParams);
  });

  it("indexes the clean catalogue at /products", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({}),
    });
    expect(metadata.title).toBe("فروشگاه بطری‌ها");
    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/products",
    );
    expect(metadata.robots).toBeUndefined();
  });

  it("noindexes search, brand, sort, page, and malformed variants at the clean canonical", async () => {
    for (const searchParams of [
      { search: "ویسکی" },
      { brand: "jack-daniel" },
      { sortBy: "price", orderBy: "asc" },
      { page: "2" },
      { page: ["2", "3"] },
      { search: "ویسکی", page: "2" },
    ]) {
      const metadata = await generateMetadata({
        searchParams: Promise.resolve(searchParams),
      });
      expect(metadata.robots).toMatchObject({ index: false, follow: false });
      expect(metadata.alternates?.canonical).toBe(
        "http://localhost:3000/products",
      );
    }
  });

  it("titles paginated and search variants without changing the canonical", async () => {
    const paged = await generateMetadata({
      searchParams: Promise.resolve({ page: "2" }),
    });
    expect(String(paged.title)).toContain("صفحهٔ ۲");

    const searched = await generateMetadata({
      searchParams: Promise.resolve({ search: "ویسکی" }),
    });
    expect(String(searched.title)).toContain("ویسکی");
  });
});
