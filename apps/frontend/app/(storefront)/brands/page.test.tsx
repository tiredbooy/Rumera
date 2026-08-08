import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listBrands: vi.fn(),
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
  listBrands: mocks.listBrands,
}));

vi.mock("@/components/storefront-media", () => ({
  StorefrontMedia: ({ alt }: { alt: string }) => (
    <div role="img" aria-label={alt} />
  ),
}));

import BrandsIndexPage from "./page";

function brandPage(results: Array<Record<string, unknown>>) {
  return {
    results,
    pagination: {
      page: 1,
      limit: 100,
      total_items: results.length,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    },
  };
}

describe("BrandsIndexPage", () => {
  beforeEach(() => {
    mocks.listBrands.mockReset();
  });

  it("renders a responsive RTL-safe brand grid with real catalogue links", async () => {
    mocks.listBrands.mockResolvedValue(
      brandPage([
        {
          id: 7,
          title: "برند رزرو",
          slug: "reserve-brand",
          country: "ایران",
          founded_year: 1984,
          image_url: "/media/brands/reserve.webp",
          description: "انتخابی برای مجموعه‌های ویژه",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: 8,
          title: "برند دوم",
          slug: "second-brand",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ]),
    );

    const markup = renderToStaticMarkup(await BrandsIndexPage());

    expect(mocks.listBrands).toHaveBeenCalledWith({
      limit: 100,
      sortBy: "title",
      orderBy: "asc",
    });
    expect(markup).toContain('aria-label="فهرست برندها"');
    expect(markup).toContain(
      "grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4",
    );
    expect(markup).toContain('href="/products?brand=reserve-brand"');
    expect(markup).toContain('aria-label="محصولات برند برند رزرو"');
    expect(markup).toContain('aria-label="برند رزرو"');
    expect(markup).toContain("ایران · تأسیس ۱۹۸۴");
    expect(markup).toContain("انتخابی برای مجموعه‌های ویژه");
    expect(markup).toContain("مشاهدهٔ محصولات این برند");
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain("motion-reduce:transition-none");
  });

  it("renders a truthful empty state", async () => {
    mocks.listBrands.mockResolvedValue(brandPage([]));

    const markup = renderToStaticMarkup(await BrandsIndexPage());

    expect(markup).toContain("هنوز برندی برای نمایش ثبت نشده است");
    expect(markup).toContain("برندی نیست");
    expect(markup).not.toContain('aria-label="فهرست برندها"');
  });

  it("renders a truthful load-error state with a catalogue escape path", async () => {
    mocks.listBrands.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(await BrandsIndexPage());

    expect(markup).toContain("بارگذاری برندها ناموفق بود");
    expect(markup).toContain("فعلاً فهرست برندها در دسترس نیست");
    expect(markup).toContain('href="/products"');
    expect(markup).not.toContain('aria-label="فهرست برندها"');
  });
});
