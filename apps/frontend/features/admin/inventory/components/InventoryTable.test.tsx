// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./stock-adjustment-popover", () => ({
  StockAdjustmentPopover: ({
    inventory,
  }: {
    inventory: { product_title: string };
  }) => <button type="button">تنظیم {inventory.product_title}</button>,
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
    expect(
      screen.getByTitle(
        "وزن بسته‌بندی روی محصول ثبت نشده — برای محاسبهٔ ارسال لازم است",
      ),
    ).toBeInTheDocument();
  });
});
