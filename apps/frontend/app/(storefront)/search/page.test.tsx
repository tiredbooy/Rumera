import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductListItem } from "@/features/catalog/products/types";

const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  redirect: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/catalog/categories/api", () => ({
  listCategories: mocks.listCategories,
}));

vi.mock("@/features/catalog/products/api/public", () => ({
  listProducts: mocks.listProducts,
}));

vi.mock("@/features/catalog/products/components/product-card", () => ({
  ProductCard: ({ product }: { product: ProductListItem }) => (
    <article data-card={product.id}>{product.title}</article>
  ),
  PRODUCT_CARD_GRID_CLASS: "grid",
}));

vi.mock(
  "@/features/storefront/search/components/search-result-product-card",
  () => ({
    SearchResultProductCard: ({ product }: { product: ProductListItem }) => (
      <article data-hit={product.id}>{product.title}</article>
    ),
  }),
);

import { SearchView } from "@/features/storefront/search/components/search-view";

const product: ProductListItem = {
  id: 11,
  title: "ویسکی تست",
  slug: "test-whisky",
  image_response: null,
  is_active: true,
  min_price: 1000,
  max_price: 1000,
  active_variant_count: 1,
  available_variant_count: 1,
  available_stock: 5,
  purchasable_variant_id: 2,
};

function productPage(results: ProductListItem[]) {
  return {
    results,
    pagination: {
      page: 1,
      limit: results.length || 24,
      total_items: results.length,
      total_pages: results.length ? 1 : 0,
      has_next: false,
      has_prev: false,
    },
  };
}

describe("SearchView error vs empty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue([]);
    mocks.listProducts.mockResolvedValue(productPage([]));
  });

  it("does not treat a search API failure as zero hits", async () => {
    mocks.listProducts.mockImplementation(
      (filter: { search?: string; page?: number }) => {
        if (filter.search) return Promise.reject(new Error("offline"));
        return Promise.resolve(productPage([product]));
      },
    );

    const markup = renderToStaticMarkup(
      await SearchView({ searchParams: Promise.resolve({ q: "ویسکی" }) }),
    );

    expect(markup).toContain("جستجو انجام نشد");
    expect(markup).toContain("تلاش مجدد");
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain("نتیجه‌ای برای «ویسکی» پیدا نشد");
    expect(markup).not.toContain("شاید این‌ها را بپسندید");
    expect(markup).not.toContain("نمونه‌هایی از سردابه");
  });

  it("keeps a successful zero-hit search as an empty state", async () => {
    mocks.listProducts.mockImplementation(
      (filter: { search?: string; page?: number }) => {
        if (filter.search) return Promise.resolve(productPage([]));
        return Promise.resolve(productPage([product]));
      },
    );

    const markup = renderToStaticMarkup(
      await SearchView({ searchParams: Promise.resolve({ q: "xyzzy" }) }),
    );

    expect(markup).toContain("نتیجه‌ای برای «xyzzy» پیدا نشد");
    expect(markup).toContain("bg-primary/10");
    expect(markup).toContain("font-serif");
    expect(markup).not.toContain("bg-muted text-muted-foreground");
    expect(markup).toContain("شاید این‌ها را بپسندید");
    expect(markup).toContain(
      'placeholder="نام، توضیحات، برند، دسته، کد، SKU یا برچسب…"',
    );
    expect(markup).toContain(
      "نام محصول، توضیحات، برند، دسته، کد، SKU و برچسب",
    );
    expect(markup).not.toContain("فعلاً جستجو روی");
    expect(markup).not.toContain("جستجو انجام نشد");
    expect(markup).not.toContain("تلاش مجدد");
  });

  it("prints the API total and pages past a single screen of hits", async () => {
    mocks.listProducts.mockImplementation(
      (filter: { search?: string; page?: number; limit?: number }) => {
        if (filter.search) {
          return Promise.resolve({
            results: [product],
            pagination: {
              page: filter.page ?? 1,
              limit: 24,
              total_items: 40,
              total_pages: 2,
              has_next: (filter.page ?? 1) < 2,
              has_prev: (filter.page ?? 1) > 1,
            },
          });
        }
        return Promise.resolve(productPage([product]));
      },
    );

    const markup = renderToStaticMarkup(
      await SearchView({ searchParams: Promise.resolve({ q: "ویسکی" }) }),
    );

    expect(markup).toContain("۴۰ نتیجه");
    expect(markup).not.toContain("۱ نتیجه");
    expect(markup).toContain('aria-label="صفحه‌بندی نتایج جستجو"');
    expect(markup).toContain("/search?q=");
    expect(mocks.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ویسکی", limit: 24, page: 1 }),
    );
  });
});
