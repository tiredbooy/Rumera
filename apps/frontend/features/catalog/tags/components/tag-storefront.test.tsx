import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Pagination } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  getTag: vi.fn(),
  listProducts: vi.fn(),
  listTags: vi.fn(),
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

vi.mock("@/features/catalog/tags/api/public", () => ({
  getTag: mocks.getTag,
  listTags: mocks.listTags,
}));

vi.mock("@/features/catalog/products/api/public", () => ({
  listProducts: mocks.listProducts,
}));

vi.mock("@/features/catalog/products/components/product-card", () => ({
  ProductCard: ({ product }: { product: { slug?: string; title: string } }) => (
    <a href={`/products/${product.slug}`}>{product.title}</a>
  ),
}));

vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));

import { TagDetailView } from "./tag-detail-view";
import { TagIndexView } from "./tag-index-view";

const tag = {
  id: 7,
  title: "هدیه",
  slug: "gift",
  description: "برای هدیه",
  created_at: "2026-07-18T00:00:00Z",
  updated_at: "2026-07-19T00:00:00Z",
};

const product = {
  id: 42,
  title: "محصول منتخب",
  slug: "selected-product",
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
  limit = 24,
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
  mocks.getTag.mockResolvedValue(tag);
  mocks.listTags.mockResolvedValue({
    results: [tag],
    pagination: pagination(),
  });
  mocks.listProducts.mockResolvedValue({
    results: [product],
    pagination: pagination(1, 1, 1, 12),
  });
});

describe("tag storefront composition", () => {
  it("renders numeric tag links and page-aware directory structured data", async () => {
    mocks.listTags.mockResolvedValue({
      results: [tag],
      pagination: pagination(2, 25, 2),
    });

    const markup = renderToStaticMarkup(
      await TagIndexView({ searchParams: Promise.resolve({ page: "2" }) }),
    );

    expect(mocks.listTags).toHaveBeenCalledWith({
      page: 2,
      limit: 24,
      sortBy: "title",
      orderBy: "asc",
    });
    expect(markup).toContain('href="/tags/7"');
    expect(markup).toContain('aria-label="صفحه‌بندی برچسب‌ها"');
    expect(markup).toContain('"position":25');
  });

  it("canonicalizes malformed directory pages", async () => {
    await expect(
      TagIndexView({ searchParams: Promise.resolve({ page: ["1", "2"] }) }),
    ).rejects.toThrow("redirect:/tags");
    expect(mocks.listTags).not.toHaveBeenCalled();
  });

  it("filters products by numeric tag and keeps pagination semantics accurate", async () => {
    mocks.listProducts.mockResolvedValue({
      results: [product],
      pagination: pagination(2, 13, 2, 12),
    });

    const markup = renderToStaticMarkup(
      await TagDetailView({
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    );

    expect(mocks.listProducts).toHaveBeenCalledWith({
      tag_id: 7,
      page: 2,
      limit: 12,
      sortBy: "created_at",
      orderBy: "desc",
    });
    expect(markup).toContain('href="/products/selected-product"');
    expect(markup).toContain('aria-label="صفحه‌بندی محصولات"');
    expect(markup).toContain('"position":13');
  });

  it("redirects an out-of-range product page to the last real page", async () => {
    mocks.listProducts.mockResolvedValue({
      results: [],
      pagination: pagination(4, 25, 3, 12),
    });

    await expect(
      TagDetailView({
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve({ page: "4" }),
      }),
    ).rejects.toThrow("redirect:/tags/7?page=3");
  });

  it("uses the tag not-found boundary without querying products", async () => {
    mocks.getTag.mockResolvedValue(null);

    await expect(
      TagDetailView({
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("not-found");
    expect(mocks.listProducts).not.toHaveBeenCalled();
  });

  it("distinguishes a valid empty tag from a transport failure", async () => {
    mocks.listProducts.mockResolvedValue({
      results: [],
      pagination: pagination(1, 0, 0, 12),
    });

    const markup = renderToStaticMarkup(
      await TagDetailView({
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(markup).toContain("محصولی با این برچسب نیست");
    expect(markup).toContain('href="/tags"');
    expect(markup).toContain('href="/products"');
    expect(markup).not.toContain('aria-label="صفحه‌بندی محصولات"');
  });
});
