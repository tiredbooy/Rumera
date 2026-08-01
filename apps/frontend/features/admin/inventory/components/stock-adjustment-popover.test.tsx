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

const mocks = vi.hoisted(() => ({
  adjust: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/features/inventory/hooks", () => ({
  InventoryMutationError: class InventoryMutationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly fields?: Record<string, string[]>,
    ) {
      super(message);
    }
  },
  useAdjustVariantStock: () => ({
    mutateAsync: mocks.adjust,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import { InventoryMutationError } from "@/features/inventory/hooks";
import { StockAdjustmentPopover } from "./stock-adjustment-popover";

const inventory = {
  id: 4,
  product_variant_id: 14,
  product_id: 3,
  product_title: "محصول آزمایشی",
  sku: "SKU-14",
  unit_price: "125000",
  stock_on_hand: 10,
  committed_stock: 2,
  available_stock: 8,
  reorder_point: 4,
  reorder_quantity: 20,
  updated_at: "2026-08-01T10:00:00Z",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adjust.mockResolvedValue(null);
});

async function openAdjustment() {
  fireEvent.click(
    screen.getByRole("button", { name: "تنظیم موجودی محصول آزمایشی" }),
  );
  return screen.findByLabelText("تغییر موجودی");
}

describe("StockAdjustmentPopover", () => {
  it("submits a Persian signed delta without claiming a final stock value", async () => {
    render(<StockAdjustmentPopover inventory={inventory} compact />);
    const input = await openAdjustment();
    fireEvent.change(input, { target: { value: "۲" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ موجودی" }));

    await waitFor(() =>
      expect(mocks.adjust).toHaveBeenCalledWith({
        variantID: 14,
        input: {
          quantity: 2,
          type: "adjustment",
          note: "تنظیم موجودی از پنل مدیریت",
        },
      }),
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "تغییر +۲ واحدی موجودی «محصول آزمایشی» ثبت شد",
    );
  });

  it("keeps invalid input visible, connected, and focused", async () => {
    render(<StockAdjustmentPopover inventory={inventory} compact />);
    const input = await openAdjustment();
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ موجودی" }));

    expect(
      await screen.findByText(
        "تغییر موجودی باید یک عدد صحیح غیرصفر در بازهٔ مجاز باشد.",
      ),
    ).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "stock-adjustment-14-error",
    );
    expect(mocks.adjust).not.toHaveBeenCalled();
  });

  it("explains a concurrent underflow instead of reporting success", async () => {
    mocks.adjust.mockRejectedValue(
      new InventoryMutationError("OUT_OF_STOCK", "out of stock"),
    );
    render(<StockAdjustmentPopover inventory={inventory} compact />);
    const input = await openAdjustment();
    fireEvent.change(input, { target: { value: "−۲۰" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ موجودی" }));

    expect(
      await screen.findByText(/موجودی در این فاصله تغییر کرده/),
    ).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
