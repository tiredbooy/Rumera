// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InventoryMovementHistory } from "./inventory-movement-history";

afterEach(cleanup);

describe("InventoryMovementHistory", () => {
  it("renders signed ledger entries, order provenance, and stable page links", () => {
    render(
      <InventoryMovementHistory
        variantID={14}
        movements={[
          {
            id: 22,
            product_variant_id: 14,
            quantity: 5,
            type: "restock",
            note: "تأمین هفتگی",
            created_at: "2026-08-01T10:00:00Z",
          },
          {
            id: 21,
            product_variant_id: 14,
            quantity: -2,
            type: "purchase",
            reference_order_id: 91,
            created_at: "2026-08-01T09:00:00Z",
          },
        ]}
        pagination={{
          page: 2,
          limit: 2,
          total_items: 6,
          total_pages: 3,
          has_prev: true,
          has_next: true,
        }}
      />,
    );

    expect(screen.getByText("تأمین انبار")).toBeInTheDocument();
    expect(screen.getByText("فروش قطعی")).toBeInTheDocument();
    expect(screen.getByText("+۵")).toBeInTheDocument();
    expect(screen.getByText("−۲")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "سفارش #۹۱" })).toHaveAttribute(
      "href",
      "/admin/orders/91",
    );
    expect(
      screen.getByRole("link", { name: "رویدادهای جدیدتر" }),
    ).toHaveAttribute("href", "/admin/inventory/14");
    expect(
      screen.getByRole("link", { name: "رویدادهای قدیمی‌تر" }),
    ).toHaveAttribute("href", "/admin/inventory/14?movement_page=3");
  });

  it("distinguishes an empty ledger from a failed route", () => {
    render(
      <InventoryMovementHistory
        variantID={14}
        movements={[]}
        pagination={{
          page: 1,
          limit: 12,
          total_items: 0,
          total_pages: 1,
          has_prev: false,
          has_next: false,
        }}
      />,
    );

    expect(
      screen.getByText("هنوز گردش موجودی ثبت نشده است"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "صفحه‌بندی گردش موجودی" }),
    ).not.toBeInTheDocument();
  });
});
