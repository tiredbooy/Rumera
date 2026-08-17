import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAdminProducts: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin/products/api/server", () => ({
  fetchAdminProducts: mocks.fetchAdminProducts,
}));
vi.mock("./ProductsTable", () => ({
  ProductsTable: ({
    products,
  }: {
    products: Array<{ id: number; title: string }>;
  }) => (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.title}</li>
      ))}
    </ul>
  ),
}));

import { ADMIN_PRODUCTS_PAGE_SIZE } from "../products-list-params";
import { ProductsListResults } from "./products-list-view";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchAdminProducts.mockResolvedValue({
    results: [
      {
        id: 9,
        title: "شراب تست",
        brand: "Test",
        min_price: 1000,
        max_price: 1000,
        is_active: false,
      },
    ],
    pagination: {
      page: 2,
      limit: ADMIN_PRODUCTS_PAGE_SIZE,
      total_items: 41,
      total_pages: 3,
      has_next: true,
      has_prev: true,
    },
  });
});

describe("admin product list", () => {
  it("queries the server with URL filters and preserves them on the pager", async () => {
    const filters = {
      query: "wine",
      page: 2,
      isActive: false as const,
      sortBy: "title" as const,
      orderBy: "asc" as const,
    };

    const markup = renderToStaticMarkup(
      await ProductsListResults({ filters, canWrite: true }),
    );

    expect(mocks.fetchAdminProducts).toHaveBeenCalledWith({
      page: 2,
      limit: ADMIN_PRODUCTS_PAGE_SIZE,
      search: "wine",
      is_active: false,
      sortBy: "title",
      orderBy: "asc",
    });
    expect(markup).toContain("شراب تست");
    expect(markup).toContain(
      'href="/admin/products?q=wine&amp;is_active=false&amp;sort=title"',
    );
    expect(markup).toContain(
      'href="/admin/products?q=wine&amp;is_active=false&amp;sort=title&amp;page=3"',
    );
    expect(markup).toContain("۴۱ محصول");
  });

  it("does not treat the current page as the whole catalogue when empty", async () => {
    mocks.fetchAdminProducts.mockResolvedValue({
      results: [],
      pagination: {
        page: 1,
        limit: ADMIN_PRODUCTS_PAGE_SIZE,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });

    const markup = renderToStaticMarkup(
      await ProductsListResults({
        filters: {
          query: "nope",
          page: 1,
          sortBy: "created_at",
          orderBy: "desc",
        },
        canWrite: true,
      }),
    );

    expect(markup).toContain("محصولی با این فیلترها یافت نشد");
    expect(markup).toContain("کل کاتالوگ");
    expect(markup).toContain('href="/admin/products"');
  });

  it("shows the fetch error card instead of empty-catalogue copy", async () => {
    mocks.fetchAdminProducts.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(
      await ProductsListResults({
        filters: {
          query: "",
          page: 1,
          sortBy: "created_at",
          orderBy: "desc",
        },
        canWrite: true,
      }),
    );

    expect(markup).toContain("دریافت محصولات ناموفق بود");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("تلاش دوباره");
    expect(markup).not.toContain("هنوز محصولی ثبت نشده است");
    expect(markup).not.toContain("محصولی با این فیلترها یافت نشد");
  });
});
