import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { InventoryItem } from "@/features/inventory/types";

const mocks = vi.hoisted(() => ({
  fetchLowStockInventory: vi.fn(),
}));

vi.mock("server-only", () => ({}));
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
vi.mock("@/features/inventory/api", () => ({
  fetchLowStockInventory: mocks.fetchLowStockInventory,
}));

import {
  LowStockList,
  lowStockRowTitle,
  lowStockRowsFromFetch,
} from "./LowStockList";

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 1,
    product_variant_id: 42,
    product_id: 7,
    product_title: "ویسکی آزمایشی",
    sku: "SKU-42",
    unit_price: "1000",
    missing_weight: false,
    stock_on_hand: 3,
    committed_stock: 1,
    available_stock: 2,
    reorder_point: 5,
    reorder_quantity: 10,
    updated_at: "2026-08-16T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lowStockRowTitle", () => {
  it("uses the live product title when the API sent one", () => {
    expect(lowStockRowTitle(item())).toBe("ویسکی آزمایشی");
  });

  it("falls back to SKU, then variant id — never invents a name", () => {
    expect(
      lowStockRowTitle(item({ product_title: "   ", sku: "SKU-42" })),
    ).toBe("SKU-42");
    expect(
      lowStockRowTitle(item({ product_title: "", sku: "  " })),
    ).toBe("#۴۲");
    expect(
      lowStockRowTitle(item({ product_title: "", sku: undefined })),
    ).toBe("#۴۲");
  });
});

describe("lowStockRowsFromFetch", () => {
  it("unwraps paginated results and rejects a missing list", () => {
    const rows = [item()];
    expect(lowStockRowsFromFetch(rows)).toEqual(rows);
    expect(lowStockRowsFromFetch({ results: rows })).toEqual(rows);
    expect(() => lowStockRowsFromFetch({ pagination: {} })).toThrow(
      /missing results/,
    );
  });
});

describe("LowStockList", () => {
  it("renders product titles from the low-stock fetch, not raw variant ids", async () => {
    mocks.fetchLowStockInventory.mockResolvedValue([
      item({ id: 1, product_title: "ویسکی آزمایشی", product_variant_id: 42 }),
      item({
        id: 2,
        product_title: "",
        sku: "SKU-99",
        product_variant_id: 99,
      }),
    ]);

    const markup = renderToStaticMarkup(
      await LowStockList({ permissions: [PERMISSIONS.INVENTORY_READ] }),
    );

    expect(markup).toContain("ویسکی آزمایشی");
    expect(markup).toContain("SKU-99");
    expect(markup).not.toContain("متغیر #");
    expect(markup).not.toContain("متغیر #۴۲");
  });

  it("reads titles from a paginated low-stock payload", async () => {
    mocks.fetchLowStockInventory.mockResolvedValue({
      results: [item({ product_title: "ویسکی آزمایشی" })],
      pagination: {
        page: 1,
        limit: 20,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });

    const markup = renderToStaticMarkup(
      await LowStockList({ permissions: [PERMISSIONS.INVENTORY_READ] }),
    );

    expect(markup).toContain("ویسکی آزمایشی");
    expect(markup).not.toContain("متغیر #");
  });

  it("shows the honest id fallback when title and SKU are both missing", async () => {
    mocks.fetchLowStockInventory.mockResolvedValue([
      item({ product_title: "", sku: undefined, product_variant_id: 42 }),
    ]);

    const markup = renderToStaticMarkup(
      await LowStockList({ permissions: [PERMISSIONS.INVENTORY_READ] }),
    );

    expect(markup).toContain("#۴۲");
    expect(markup).not.toContain("متغیر #");
  });
});
