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
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  update: vi.fn(),
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
  useUpdateVariantReorder: () => ({
    mutateAsync: mocks.update,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}));

import { InventoryMutationError } from "@/features/inventory/hooks";
import { ReorderThresholdForm } from "./reorder-threshold-form";

const inventory = {
  id: 4,
  product_variant_id: 14,
  product_id: 3,
  product_title: "محصول آزمایشی",
  unit_price: "125000",
  missing_weight: false,
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
});

describe("ReorderThresholdForm", () => {
  it("submits localized integers and displays the confirmed response", async () => {
    mocks.update.mockResolvedValue({
      ...inventory,
      reorder_point: 7,
      reorder_quantity: 30,
    });
    render(<ReorderThresholdForm inventory={inventory} />);
    fireEvent.change(screen.getByLabelText("آستانهٔ سفارش"), {
      target: { value: "۷" },
    });
    fireEvent.change(screen.getByLabelText("مقدار پیشنهادی سفارش"), {
      target: { value: "٣٠" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ آستانه‌ها" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        variantID: 14,
        input: { reorder_point: 7, reorder_quantity: 30 },
      }),
    );
    expect(
      await screen.findByText(
        "مقدار تأییدشده: آستانه ۷، سفارش پیشنهادی ۳۰ واحد.",
      ),
    ).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("connects client validation and focuses the first invalid field", async () => {
    render(<ReorderThresholdForm inventory={inventory} />);
    const point = screen.getByLabelText("آستانهٔ سفارش");
    fireEvent.change(point, { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ آستانه‌ها" }));

    expect(
      await screen.findByText("آستانهٔ سفارش باید یک عدد صحیح و نامنفی باشد"),
    ).toBeInTheDocument();
    expect(point).toHaveFocus();
    expect(point).toHaveAttribute("aria-describedby", "reorder_point-error");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("omits an unchanged field instead of overwriting a concurrent edit", async () => {
    mocks.update.mockResolvedValue({
      ...inventory,
      reorder_point: 7,
    });
    render(<ReorderThresholdForm inventory={inventory} />);
    fireEvent.change(screen.getByLabelText("آستانهٔ سفارش"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ آستانه‌ها" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        variantID: 14,
        input: { reorder_point: 7 },
      }),
    );
  });

  it("maps backend field errors back to the corresponding control", async () => {
    mocks.update.mockRejectedValue(
      new InventoryMutationError("VALIDATION_ERROR", "invalid", {
        reorder_point: ["آستانهٔ سفارش معتبر نیست"],
      }),
    );
    render(<ReorderThresholdForm inventory={inventory} />);
    const point = screen.getByLabelText("آستانهٔ سفارش");
    fireEvent.change(point, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ آستانه‌ها" }));

    expect(
      await screen.findByText("آستانهٔ سفارش معتبر نیست"),
    ).toBeInTheDocument();
    expect(point).toHaveFocus();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
