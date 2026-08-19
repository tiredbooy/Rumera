import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderStreamedMarkup,
  renderStreamedShell,
} from "@/lib/testing/render-stream";

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
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/products",
  useSearchParams: () => new URLSearchParams(),
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

import { PRODUCT_LIST_PAGE_SIZE } from "@/features/catalog/products/list-routing";

import {
  PRODUCT_CARD_GRID_CLASS,
  PRODUCT_CARD_MEDIA_FRAME_CLASS,
} from "./product-card";

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

describe("ProductListView error vs empty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue([]);
    mocks.listBrands.mockResolvedValue({ ...emptyPage, results: [] });
    mocks.getBrandBySlug.mockResolvedValue(null);
  });

  it("shows a retryable error instead of the empty catalogue copy", async () => {
    mocks.listProducts.mockRejectedValue(new Error("offline"));

    const markup = await renderStreamedMarkup(
      <ProductListView searchParams={Promise.resolve({})} />,
    );

    expect(markup).toContain("فهرست محصولات بارگذاری نشد");
    expect(markup).toContain("فعلاً فهرست محصولات در دسترس نیست");
    expect(markup).toContain("تلاش مجدد");
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain("محصولی برای نمایش نیست");
    expect(markup).not.toContain("هنوز محصول منتشرشده‌ای در فروشگاه نیست");
    expect(markup).not.toContain("۰ محصول");
  });

  it("keeps a successful empty list distinct from an API outage", async () => {
    mocks.listProducts.mockResolvedValue(emptyPage);

    const markup = await renderStreamedMarkup(
      <ProductListView searchParams={Promise.resolve({})} />,
    );

    expect(markup).toContain("محصولی برای نمایش نیست");
    expect(markup).toContain("هنوز محصول منتشرشده‌ای در فروشگاه نیست");
    expect(markup).not.toContain("فهرست محصولات بارگذاری نشد");
    expect(markup).not.toContain("تلاش مجدد");
    expect(markup).not.toContain("اگر سرویس در دسترس نیست");
  });
});

describe("ProductListView filter chips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProducts.mockResolvedValue(emptyPage);
    mocks.listBrands.mockResolvedValue({ ...emptyPage, results: [brand] });
    mocks.getBrandBySlug.mockResolvedValue(brand);
    mocks.listCategories.mockResolvedValue([
      {
        id: 3,
        title: "ویسکی",
        slug: "whisky",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("gives category and brand chips a 44px coarse-pointer target", async () => {
    const markup = await renderStreamedMarkup(
      <ProductListView searchParams={Promise.resolve({})} />,
    );

    expect(markup).toContain("[@media(any-pointer:coarse)]:min-h-11");
    expect(markup).toContain("ویسکی");
    expect(markup).toContain("Jack Daniel");
  });
});

describe("ProductListView streaming", () => {
  /** Held open until the shell has flushed, so «pending» really means pending. */
  let releaseProducts: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue([]);
    mocks.listBrands.mockResolvedValue({ ...emptyPage, results: [brand] });
    mocks.getBrandBySlug.mockResolvedValue(null);
    mocks.listProducts.mockReturnValue(
      new Promise((resolve) => {
        releaseProducts = () => resolve(emptyPage);
      }),
    );
  });

  function renderWithPendingCatalogue() {
    return renderStreamedShell(
      <ProductListView searchParams={Promise.resolve({})} />,
      () => releaseProducts(),
    );
  }

  it("flushes the shell while the catalogue is still pending", async () => {
    const { shell, html } = await renderWithPendingCatalogue();

    expect(shell.length).toBeLessThan(html.length);
    expect(shell).toContain("فروشگاه بطری‌ها");
    expect(shell).toContain('aria-label="جستجو در کاتالوگ"');
    expect(shell).toContain("Jack Daniel");
    expect(shell).toContain('data-slot="route-loading"');
    expect(shell).not.toContain("محصولی برای نمایش نیست");
    expect(shell).not.toContain("محصول — بر اساس دسته یا برند مرور کنید");

    expect(html).toContain("محصولی برای نمایش نیست");
    expect(html).toContain("محصول — بر اساس دسته یا برند مرور کنید");
  });

  it("falls back to one full page of placeholder cards", async () => {
    const { shell } = await renderWithPendingCatalogue();

    expect(shell.split(PRODUCT_CARD_MEDIA_FRAME_CLASS).length - 1).toBe(
      PRODUCT_LIST_PAGE_SIZE,
    );
    expect(shell).toContain(PRODUCT_CARD_GRID_CLASS);
  });

  it("keeps the catalogue request concurrent with the shell lookups", async () => {
    await renderWithPendingCatalogue();

    // Fired before the brand/category lookups are awaited, not after them.
    expect(mocks.listProducts).toHaveBeenCalledTimes(1);
    expect(mocks.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ limit: PRODUCT_LIST_PAGE_SIZE, page: 1 }),
    );
  });
});
