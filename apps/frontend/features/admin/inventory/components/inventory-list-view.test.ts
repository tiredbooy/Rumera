import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  listInventory: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  table: vi.fn(() => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/inventory/api", () => ({
  listInventory: mocks.listInventory,
  listAllInventory: () => {
    throw new Error("listAllInventory must not be used");
  },
}));
vi.mock("./InventoryTable", () => ({
  InventoryTable: mocks.table,
}));

import type { InventoryItem, InventoryListQuery } from "@/features/inventory/types";

import { InventoryListResults } from "./inventory-list-view";

function flatten(node: unknown): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === "object" && node !== null && "props" in node) {
    const el = node as { type: unknown; props: { children?: unknown } };
    return [el, ...flatten(el.props.children)];
  }
  return [];
}

function findByType(node: unknown, type: unknown) {
  return flatten(node).find((item) => item.type === type);
}

const row: InventoryItem = {
  id: 4,
  product_variant_id: 14,
  product_id: 3,
  product_title: "محصول آزمایشی",
  sku: "SKU-14",
  category_title: "هدیه",
  unit_price: "125000",
  missing_weight: false,
  stock_on_hand: 10,
  committed_stock: 2,
  available_stock: 8,
  reorder_point: 4,
  reorder_quantity: 20,
  updated_at: "2026-08-01T10:00:00Z",
};

function pageOf(
  results: InventoryItem[],
  pagination: Partial<{
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  }> = {},
) {
  const page = pagination.page ?? 1;
  const totalPages = pagination.total_pages ?? 1;
  return {
    results,
    pagination: {
      page,
      limit: pagination.limit ?? 20,
      total_items: pagination.total_items ?? results.length,
      total_pages: totalPages,
      has_next: pagination.has_next ?? page < totalPages,
      has_prev: pagination.has_prev ?? page > 1,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listInventory.mockImplementation(async (query: InventoryListQuery) => {
    if (query.limit === 1) {
      return pageOf([], {
        limit: 1,
        total_items: query.low_stock ? 3 : 40,
        total_pages: 1,
      });
    }
    return pageOf([row], {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      total_items: 40,
      total_pages: 2,
    });
  });
});

describe("InventoryListResults", () => {
  it("loads one sorted page and a cheap low-stock total", async () => {
    const element = await InventoryListResults({
      filters: { query: "", page: 1, lowStock: false },
      canWrite: false,
    });

    const queries = mocks.listInventory.mock.calls.map(
      ([query]) => query as InventoryListQuery,
    );
    expect(queries).toEqual(
      expect.arrayContaining([
        {
          page: 1,
          limit: 20,
          search: undefined,
          low_stock: undefined,
          sortBy: "updated_at",
          orderBy: "desc",
        },
        {
          page: 1,
          limit: 1,
          low_stock: true,
          sortBy: "updated_at",
          orderBy: "desc",
        },
      ]),
    );
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => query.limit !== 100)).toBe(true);
    expect(findByType(element, mocks.table)?.props).toEqual({
      inventory: [row],
      canWrite: false,
    });
    const markup = renderToStaticMarkup(element);
    expect(markup).toContain("در این صفحه");
    expect(markup).toContain("کل انبار");
    expect(markup).toContain("ردیف در کل انبار");
  });

  it("forwards search and low_stock to the list contract", async () => {
    const element = await InventoryListResults({
      filters: { query: "wine", page: 2, lowStock: true },
      canWrite: true,
    });

    const queries = mocks.listInventory.mock.calls.map(
      ([query]) => query as InventoryListQuery,
    );
    expect(queries).toEqual(
      expect.arrayContaining([
        {
          page: 2,
          limit: 20,
          search: "wine",
          low_stock: true,
          sortBy: "updated_at",
          orderBy: "desc",
        },
        {
          page: 1,
          limit: 1,
          sortBy: "updated_at",
          orderBy: "desc",
        },
      ]),
    );
    expect(queries).toHaveLength(2);
    expect(queries.some((query) => query.search === "wine")).toBe(true);
    expect(findByType(element, mocks.table)?.props).toEqual({
      inventory: [row],
      canWrite: true,
    });
  });

  it("redirects an out-of-range page onto the last page", async () => {
    mocks.listInventory.mockImplementation(async (query: InventoryListQuery) => {
      if (query.limit === 1) {
        return pageOf([], { limit: 1, total_items: 21, total_pages: 2 });
      }
      return pageOf([], {
        page: 9,
        limit: 20,
        total_items: 21,
        total_pages: 2,
      });
    });

    await expect(
      InventoryListResults({
        filters: { query: "wine", page: 9, lowStock: true },
        canWrite: false,
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/inventory?q=wine&low_stock=true&page=2",
    );
  });

  it("does not render the table when the filtered page is empty", async () => {
    mocks.listInventory.mockResolvedValue(
      pageOf([], { total_items: 0, total_pages: 1 }),
    );

    const element = await InventoryListResults({
      filters: { query: "missing", page: 1, lowStock: false },
      canWrite: false,
    });

    expect(findByType(element, mocks.table)).toBeUndefined();
  });

  it("points an empty warehouse at product create, not make seed", async () => {
    mocks.listInventory.mockResolvedValue(
      pageOf([], { total_items: 0, total_pages: 1 }),
    );

    const markup = renderToStaticMarkup(
      await InventoryListResults({
        filters: { query: "", page: 1, lowStock: false },
        canWrite: false,
      }),
    );

    expect(markup).toContain("هنوز ردیف موجودی ندارید");
    expect(markup).toContain("افزودن محصول");
    expect(markup).toContain("/admin/products/new");
    expect(markup).not.toContain("make seed");
    expect(markup).not.toContain("دیتابیس");
  });

  it("shows the fetch error card instead of empty-catalogue copy", async () => {
    mocks.listInventory.mockRejectedValue(new Error("offline"));

    const element = await InventoryListResults({
      filters: { query: "", page: 1, lowStock: false },
      canWrite: false,
    });
    const markup = renderToStaticMarkup(element);

    expect(findByType(element, mocks.table)).toBeUndefined();
    expect(markup).toContain("دریافت موجودی ناموفق بود");
    expect(markup).toContain("هیچ فهرست جایگزینی نمایش داده نشده است");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("تلاش دوباره");
    expect(markup).not.toContain("هنوز ردیف موجودی ندارید");
    expect(markup).not.toContain("رکورد موجودی مطابق این جستجو پیدا نشد");
    expect(markup).not.toContain("تعداد کالا");
  });

  it("does not treat a filtered-page fetch failure as zero matches", async () => {
    mocks.listInventory.mockRejectedValue(
      new ApiError(500, "INTERNAL", "boom"),
    );

    const markup = renderToStaticMarkup(
      await InventoryListResults({
        filters: { query: "wine", page: 2, lowStock: true },
        canWrite: true,
      }),
    );

    expect(markup).toContain("دریافت موجودی ناموفق بود");
    expect(markup).not.toContain("رکورد موجودی مطابق این جستجو پیدا نشد");
    expect(markup).not.toContain("پاک کردن فیلترها");
  });

  it.each([401, 403] as const)(
    "rethrows %s so auth/forbidden stay outside the retry card",
    async (status) => {
      const error = new ApiError(status, "FORBIDDEN", "no access");
      mocks.listInventory.mockRejectedValue(error);

      await expect(
        InventoryListResults({
          filters: { query: "", page: 1, lowStock: false },
          canWrite: false,
        }),
      ).rejects.toBe(error);
      expect(mocks.table).not.toHaveBeenCalled();
    },
  );
});
