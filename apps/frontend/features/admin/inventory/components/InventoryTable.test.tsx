// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./stock-adjustment-popover", () => ({
  StockAdjustmentPopover: ({
    inventory,
  }: {
    inventory: { product_title: string };
  }) => <button type="button">تنظیم {inventory.product_title}</button>,
}));

// The bar itself is covered in bulk-stock-adjustment.test.tsx; here it only has
// to report what the table hands it.
vi.mock("./bulk-stock-adjustment", () => ({
  BulkStockAdjustment: ({
    pageRowCount,
    selected,
    facetActive,
    visibleRowCount,
    onToggleAll,
  }: {
    pageRowCount: number;
    selected: { product_title: string }[];
    facetActive?: boolean;
    visibleRowCount?: number;
    onToggleAll: (next: boolean) => void;
  }) => (
    <div>
      <p>
        انتخاب {selected.length} از {pageRowCount}
        {selected.map((row) => ` · ${row.product_title}`)}
      </p>
      {facetActive ? <p>نمایش‌داده‌شده {visibleRowCount}</p> : null}
      <button type="button" onClick={() => onToggleAll(true)}>
        انتخاب همهٔ قابل‌مشاهده
      </button>
    </div>
  ),
}));

import { InventoryTable } from "./InventoryTable";

const inventory = [
  {
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
  },
];

afterEach(cleanup);

beforeEach(() => {
  Object.defineProperty(Element.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(Element.prototype, "releasePointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
});

describe("InventoryTable", () => {
  it("links every readable row to its ledger and exposes threshold values", () => {
    render(<InventoryTable inventory={inventory} canWrite={false} />);

    expect(screen.getByText("محصول آزمایشی").closest("a")).toHaveAttribute(
      "href",
      "/admin/inventory/14",
    );
    expect(
      screen.getByRole("link", {
        name: "مشاهدهٔ گردش موجودی محصول آزمایشی",
      }),
    ).toHaveAttribute("href", "/admin/inventory/14");
    expect(screen.getByText("آستانه ۴")).toBeInTheDocument();
    expect(screen.getByText("پیشنهاد ۲۰")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "تنظیم محصول آزمایشی" }),
    ).not.toBeInTheDocument();
  });

  it("shows the real adjustment control only to writers", () => {
    render(<InventoryTable inventory={inventory} canWrite />);
    expect(
      screen.getByRole("button", { name: "تنظیم محصول آزمایشی" }),
    ).toBeInTheDocument();
  });

  it("gives writers a per-row checkbox wired to the bulk bar", () => {
    render(
      <InventoryTable
        canWrite
        inventory={[
          inventory[0],
          { ...inventory[0], id: 5, product_variant_id: 15 },
        ]}
      />,
    );

    expect(screen.getByText(/انتخاب 0 از 2/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText("انتخاب محصول آزمایشی")[1]);
    expect(screen.getByText(/انتخاب 1 از 2/)).toBeInTheDocument();
  });

  it("keeps selection out of a read-only list", () => {
    render(<InventoryTable inventory={inventory} canWrite={false} />);
    expect(screen.queryByText(/انتخاب 0 از/)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("انتخاب محصول آزمایشی"),
    ).not.toBeInTheDocument();
  });

  it("surfaces missing_weight remediation signal (PH-020b / 085a)", () => {
    render(
      <InventoryTable
        canWrite={false}
        inventory={[
          {
            ...inventory[0],
            missing_weight: true,
            weight: undefined,
          },
        ]}
      />,
    );
    expect(screen.getByText("وزن ناقص")).toBeInTheDocument();
    const physical = screen.getByRole("columnheader", { name: /فیزیکی/ });
    expect(physical.closest("thead")).toHaveClass("sticky", "top-0");
    expect(
      screen.getByText("فیلتر جدول فقط روی ردیف‌های همین صفحه است، نه کل انبار."),
    ).toBeInTheDocument();
    expect(screen.getByText("۱ از ۱ ردیف این صفحه")).toBeInTheDocument();
    expect(
      screen.getByTitle(
        "وزن بسته‌بندی روی محصول ثبت نشده — برای محاسبهٔ ارسال لازم است",
      ),
    ).toBeInTheDocument();
  });

  it("select-all only covers the rows a facet is still showing", async () => {
    render(
      <InventoryTable
        canWrite
        inventory={[
          { ...inventory[0], product_title: "هدیه یک", category_title: "هدیه" },
          {
            ...inventory[0],
            id: 5,
            product_variant_id: 15,
            product_title: "نوشیدنی یک",
            category_title: "نوشیدنی",
          },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /دسته/ });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "هدیه" }));

    await waitFor(() => {
      expect(screen.getByText(/نمایش‌داده‌شده/)).toHaveTextContent("1");
    });

    fireEvent.click(screen.getByRole("button", { name: "انتخاب همهٔ قابل‌مشاهده" }));

    expect(screen.getByText(/انتخاب 1 از 2/)).toHaveTextContent("هدیه یک");
    expect(screen.getByText(/انتخاب 1 از 2/)).not.toHaveTextContent("نوشیدنی یک");
  });

  it("tells an empty warehouse to add a product, not run make seed", () => {
    const { container } = render(
      <InventoryTable inventory={[]} canWrite={false} />,
    );
    expect(container.textContent).not.toContain("make seed");
    expect(screen.getByRole("link", { name: "افزودن محصول" })).toHaveAttribute(
      "href",
      "/admin/products/new",
    );
  });

  it("keeps the numeric column headers stuck while the rows scroll", () => {
    render(<InventoryTable inventory={inventory} canWrite={false} />);
    for (const label of ["فیزیکی", "رزرو", "قابل فروش"]) {
      expect(screen.getByRole("columnheader", { name: label })).toHaveClass(
        "sticky",
      );
    }
  });
});
