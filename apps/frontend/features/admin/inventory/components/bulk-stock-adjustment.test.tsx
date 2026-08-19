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
  bulkAdjust: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("../bulk-actions", () => ({
  bulkAdjustVariantStockAction: mocks.bulkAdjust,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import type { InventoryItem } from "@/features/inventory/types";

import {
  BulkStockAdjustment,
  planBulkAdjustments,
} from "./bulk-stock-adjustment";

function item(overrides: Partial<InventoryItem> & { id: number }): InventoryItem {
  return {
    product_variant_id: overrides.id,
    product_id: 3,
    product_title: `محصول ${overrides.id}`,
    unit_price: "125000",
    missing_weight: false,
    stock_on_hand: 10,
    committed_stock: 2,
    available_stock: 8,
    reorder_point: 4,
    reorder_quantity: 20,
    updated_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

const rows = [item({ id: 1 }), item({ id: 2 }), item({ id: 3 })];

function renderBar(
  props: Partial<React.ComponentProps<typeof BulkStockAdjustment>> = {},
) {
  const onKeepOnly = vi.fn();
  const onToggleAll = vi.fn();
  render(
    <BulkStockAdjustment
      pageRowCount={3}
      selected={rows}
      allSelected
      onToggleAll={onToggleAll}
      onKeepOnly={onKeepOnly}
      {...props}
    />,
  );
  return { onKeepOnly, onToggleAll };
}

async function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "تنظیم گروهی موجودی" }));
  return screen.findByLabelText("تغییر موجودی (±)");
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bulkAdjust.mockResolvedValue({
    ok: true,
    data: { applied: [1, 2, 3], failed: [] },
  });
});

describe("planBulkAdjustments", () => {
  it("keeps a row out of the batch when the delta would cut into the reserve", () => {
    const plan = planBulkAdjustments(
      [item({ id: 1 }), item({ id: 2, stock_on_hand: 3, committed_stock: 3 })],
      "fixed",
      -2,
    );
    expect(plan[0].blocked).toBeNull();
    expect(plan[1].blocked).toContain("رزرو");
  });

  it("uses each row's own suggestion in reorder mode and blocks the ones without", () => {
    const plan = planBulkAdjustments(
      [item({ id: 1, reorder_quantity: 24 }), item({ id: 2, reorder_quantity: 0 })],
      "reorder",
      null,
    );
    expect(plan[0]).toMatchObject({ quantity: 24, blocked: null });
    expect(plan[1].blocked).toBe("مقدار پیشنهادی ثبت نشده");
  });

  it("blocks an unparsable or zero delta", () => {
    expect(planBulkAdjustments([item({ id: 1 })], "fixed", null)[0].blocked).toBe(
      "مقدار تغییر معتبر نیست",
    );
  });
});

describe("BulkStockAdjustment", () => {
  it("sends one audited movement per variant, not a bulk field edit", async () => {
    renderBar();
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /ثبت برای/ }));

    await waitFor(() => expect(mocks.bulkAdjust).toHaveBeenCalledTimes(1));
    expect(mocks.bulkAdjust).toHaveBeenCalledWith([
      {
        variantID: 1,
        quantity: 5,
        type: "restock",
        note: "تأمین گروهی از پنل مدیریت",
      },
      {
        variantID: 2,
        quantity: 5,
        type: "restock",
        note: "تأمین گروهی از پنل مدیریت",
      },
      {
        variantID: 3,
        quantity: 5,
        type: "restock",
        note: "تأمین گروهی از پنل مدیریت",
      },
    ]);
  });

  it("carries the decrease reason into every movement", async () => {
    renderBar();
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("دلیل کاهش"), {
      target: { value: "damage" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ثبت برای/ }));

    await waitFor(() => expect(mocks.bulkAdjust).toHaveBeenCalledTimes(1));
    for (const adjustment of mocks.bulkAdjust.mock.calls[0][0]) {
      expect(adjustment).toMatchObject({
        type: "damage",
        note: "ضایعات / شکستگی گروهی از پنل مدیریت",
      });
    }
  });

  it("names the rows that failed and leaves only those selected", async () => {
    mocks.bulkAdjust.mockResolvedValue({
      ok: true,
      data: {
        applied: [1],
        failed: [
          { variantID: 2, code: "INSUFFICIENT_STOCK", message: "" },
          { variantID: 3, code: "NOT_FOUND", message: "" },
        ],
      },
    });
    const { onKeepOnly } = renderBar();
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /ثبت برای/ }));

    const report = await screen.findByRole("alert");
    expect(report).toHaveTextContent("محصول 2");
    expect(report).toHaveTextContent("محصول 3");
    expect(report).not.toHaveTextContent("محصول 1");
    expect(report).toHaveTextContent("واریانت پیدا نشد.");
    // The applied row drops out of the selection, so the retry the operator
    // reaches for cannot record a second movement for it.
    expect(onKeepOnly).toHaveBeenCalledWith([2, 3]);
    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("clears the selection after a clean batch", async () => {
    const { onKeepOnly } = renderBar();
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /ثبت برای/ }));

    await waitFor(() => expect(onKeepOnly).toHaveBeenCalledWith([]));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("موجودی ۳ ردیف ثبت شد");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("submits only the rows that can move and says how many are skipped", async () => {
    renderBar({
      selected: [
        item({ id: 1 }),
        item({ id: 2, stock_on_hand: 3, committed_stock: 3 }),
      ],
    });
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "-2" } });

    const submit = screen.getByRole("button", { name: /ثبت برای/ });
    expect(submit).toHaveTextContent("ثبت برای ۱ ردیف · ۱ ردیف نادیده");
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.bulkAdjust).toHaveBeenCalledTimes(1));
    expect(mocks.bulkAdjust.mock.calls[0][0]).toHaveLength(1);
    expect(mocks.bulkAdjust.mock.calls[0][0][0].variantID).toBe(1);
  });

  it("says the selection is page-scoped and offers select-all for the page", () => {
    const { onToggleAll } = renderBar({ selected: [], allSelected: false });
    expect(
      screen.getByText("برای اعمال گروهی، ردیف‌ها را انتخاب کنید"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "تنظیم گروهی موجودی" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByLabelText("انتخاب همهٔ ۳ ردیف این صفحه"));
    expect(onToggleAll).toHaveBeenCalledWith(true);
  });

  it("does not claim the whole page when a facet is hiding rows", () => {
    renderBar({
      selected: [rows[0]],
      allSelected: true,
      visibleRowCount: 1,
      facetActive: true,
      pageRowCount: 3,
    });

    expect(
      screen.getByLabelText("انتخاب همهٔ ۱ ردیف نمایش‌داده‌شده"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("انتخاب همهٔ ۳ ردیف این صفحه"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/ردیف نمایش‌داده‌شده انتخاب شده/)).toBeInTheDocument();
  });

  it("treats a thrown batch as unknown state and keeps the selection", async () => {
    mocks.bulkAdjust.mockRejectedValueOnce(new Error("network"));
    const { onKeepOnly } = renderBar();
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /ثبت برای/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastError.mock.calls[0][0]).toMatch(/نامشخص/);
    expect(onKeepOnly).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /ثبت برای/ })).toHaveTextContent(
      "ثبت برای",
    );
    expect(
      screen.getByRole("button", { name: /ثبت برای/ }),
    ).not.toHaveTextContent("در حال ثبت");
  });
});
