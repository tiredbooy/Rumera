import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Pagination } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  getCategoryBySlug: vi.fn(),
  getCategoryTree: vi.fn(),
  listProducts: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
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

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt, src }: { alt: string; src?: string }) => (
    <div role="img" aria-label={alt} data-src={src} />
  ),
}));

vi.mock("@/features/catalog/categories/api", () => ({
  getCategoryBySlug: mocks.getCategoryBySlug,
  getCategoryTree: mocks.getCategoryTree,
}));

vi.mock("@/features/catalog/products/api/public", () => ({
  listProducts: mocks.listProducts,
}));

vi.mock("@/features/catalog/products/components/product-card", () => ({
  PRODUCT_CARD_GRID_CLASS: "grid",
  ProductCard: ({ product }: { product: { slug?: string; title: string } }) => (
    <article data-product-card>
      {product.slug ? (
        <a href={`/products/${product.slug}`}>{product.title}</a>
      ) : (
        product.title
      )}
    </article>
  ),
}));

import { CategoryDetailView } from "./category-detail-view";

const root = {
  id: 1,
  title: "نوشیدنی‌ها",
  slug: "spirits",
  description: "ریشهٔ مجموعه",
};

const child = {
  id: 3,
  title: "تک‌مالت",
  slug: "single-malt",
  description: "زیرشاخهٔ منتخب",
};

const nestedChild = {
  id: 5,
  title: "بوربن",
  slug: "bourbon",
};

const structuralChild = {
  id: 4,
  title: "سبک‌ها",
  children: [nestedChild],
};

const category = {
  id: 2,
  title: "ویسکی",
  slug: "whisky",
  description: "ویسکی‌های منتخب",
  image_url: "/images/whisky.jpg",
  parent_id: root.id,
  is_featured: false,
  display_order: 0,
};

const tree = [
  {
    ...root,
    children: [{ ...category, children: [child, structuralChild] }],
  },
];

const product = {
  id: 42,
  title: "مالت زیرشاخه",
  slug: "descendant-malt",
  category: child.title,
  image_response: null,
  is_active: true,
  min_price: 100,
  max_price: 100,
  active_variant_count: 1,
  available_variant_count: 1,
};

function pagination(
  page = 1,
  totalItems = 1,
  totalPages = 1,
  limit = 12,
): Pagination {
  return {
    page,
    limit,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCategoryBySlug.mockResolvedValue(category);
  mocks.getCategoryTree.mockResolvedValue(tree);
  mocks.listProducts.mockResolvedValue({
    results: [product],
    pagination: pagination(),
  });
});

describe("category detail composition", () => {
  it("renders ancestor and child links with descendant-aware page-two results", async () => {
    mocks.listProducts.mockResolvedValue({
      results: [
        product,
        { ...product, id: 43, title: "بدون مسیر عمومی", slug: undefined },
      ],
      pagination: pagination(2, 25, 3),
    });

    const markup = renderToStaticMarkup(
      await CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    );

    expect(mocks.listProducts).toHaveBeenCalledWith({
      category_id: category.id,
      include_descendants: true,
      page: 2,
      limit: 12,
      sortBy: "created_at",
      orderBy: "desc",
    });
    expect(markup).toContain('href="/categories/spirits"');
    expect(markup).toContain('href="/categories/single-malt"');
    expect(markup).toContain('href="/categories/bourbon"');
    expect(markup).toContain(
      `aria-label="زیرشاخه‌های ${structuralChild.title}"`,
    );
    expect(markup).toContain('href="/products/descendant-malt"');
    expect(markup).toContain("در این شاخه و زیرشاخه‌های آن");
    expect(markup).toContain('id="category-products-grid"');
    expect(markup).toContain("<li");
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-label="صفحه‌بندی محصولات دسته‌بندی"');
    expect(markup).toContain('"position":13');
    expect(markup).not.toContain("/products/undefined");
  });

  it("sends only supported API filters and preserves q/sort through pagination", async () => {
    mocks.listProducts.mockResolvedValue({
      results: [product],
      pagination: pagination(2, 25, 3),
    });

    const markup = renderToStaticMarkup(
      await CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({
          page: "2",
          q: "مالت",
          sort: "alphabetical",
        }),
      }),
    );

    expect(mocks.listProducts).toHaveBeenCalledWith({
      category_id: category.id,
      include_descendants: true,
      page: 2,
      limit: 12,
      search: "مالت",
      sortBy: "title",
      orderBy: "asc",
    });
    const requestedFilter = mocks.listProducts.mock.calls[0]?.[0];
    expect(Object.keys(requestedFilter).sort()).toEqual(
      [
        "category_id",
        "include_descendants",
        "limit",
        "orderBy",
        "page",
        "search",
        "sortBy",
      ].sort(),
    );
    expect(markup).toContain("فیلتر فعال");
    expect(markup).toContain(
      `href="/categories/whisky?q=${encodeURIComponent("مالت")}&amp;sort=alphabetical#category-products-title"`,
    );
    expect(markup).toContain(
      `href="/categories/whisky?q=${encodeURIComponent("مالت")}&amp;sort=alphabetical&amp;page=3#category-products-title"`,
    );
  });

  it("distinguishes an intrinsically empty branch from a search-empty result", async () => {
    mocks.listProducts.mockResolvedValue({
      results: [],
      pagination: pagination(1, 0, 1),
    });

    const intrinsic = renderToStaticMarkup(
      await CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(intrinsic).toContain("هنوز محصولی در این شاخه نیست");
    expect(intrinsic).toContain('href="#category-children"');
    expect(intrinsic).toContain('href="/products"');
    expect(intrinsic).not.toContain("پاک کردن جست‌وجو");

    const filtered = renderToStaticMarkup(
      await CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({ q: "ناموجود" }),
      }),
    );
    expect(filtered).toContain("برای «ناموجود» محصولی پیدا نشد");
    expect(filtered).toContain("پاک کردن جست‌وجو");
    expect(filtered).toContain(
      'href="/categories/whisky#category-products-title"',
    );
    expect(filtered).not.toContain("هنوز محصولی در این شاخه نیست");
  });

  it("recovers out-of-range pages without dropping canonical filters", async () => {
    mocks.listProducts.mockResolvedValue({
      results: [],
      pagination: pagination(5, 25, 3),
    });

    await expect(
      CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({
          page: "5",
          q: "مالت",
          sort: "recently-updated",
        }),
      }),
    ).rejects.toThrow(
      `redirect:/categories/whisky?q=${encodeURIComponent("مالت")}&sort=recently-updated&page=3`,
    );

    mocks.listProducts.mockResolvedValue({
      results: [],
      pagination: pagination(4, 0, 1),
    });
    await expect(
      CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({ page: "4", q: "هیچ" }),
      }),
    ).rejects.toThrow(
      `redirect:/categories/whisky?q=${encodeURIComponent("هیچ")}`,
    );
  });

  it("canonicalizes ambiguous query values before requesting products", async () => {
    await expect(
      CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({ page: ["2", "3"], sort: "price" }),
      }),
    ).rejects.toThrow("redirect:/categories/whisky");
    expect(mocks.listProducts).not.toHaveBeenCalled();
  });

  it("uses not-found before loading hierarchy and leaves operational failures uncaught", async () => {
    mocks.getCategoryBySlug.mockResolvedValue(null);
    mocks.getCategoryTree.mockRejectedValue(new Error("tree unavailable"));
    await expect(
      CategoryDetailView({
        params: Promise.resolve({ category: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("not-found");
    expect(mocks.getCategoryTree).not.toHaveBeenCalled();
    expect(mocks.listProducts).not.toHaveBeenCalled();

    const failure = new Error("category API unavailable");
    mocks.getCategoryBySlug.mockRejectedValue(failure);
    await expect(
      CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(failure);
  });

  it("treats a category missing from the public tree as an operational inconsistency", async () => {
    mocks.getCategoryTree.mockResolvedValue([]);

    await expect(
      CategoryDetailView({
        params: Promise.resolve({ category: "whisky" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("missing from the public tree");
    expect(mocks.listProducts).not.toHaveBeenCalled();
  });
});
