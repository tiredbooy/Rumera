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
import { useForm, useWatch } from "react-hook-form";

import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { InventoryItem } from "@/features/inventory/types";
import type { ProductFormValues } from "../../validations";

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn(), refresh: vi.fn() }));

vi.mock("@/features/inventory/hooks", () => ({
  InventoryMutationError: class extends Error {},
  useAdjustVariantStock: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VariantRow, cellAddress } from "./VariantRow";

afterEach(cleanup);

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

const color: ProductOptionGroup = {
  id: 4,
  title: "color",
  display_name: "رنگ",
  created_at: "2026-07-26T00:00:00Z",
  updated_at: "2026-07-26T00:00:00Z",
  values: [
    {
      id: 10,
      option_type_id: 4,
      value: "قرمز",
      sort_order: 0,
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
    {
      id: 11,
      option_type_id: 4,
      value: "آبی",
      sort_order: 1,
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
  ],
};

function renderRow(
  props: Partial<React.ComponentProps<typeof VariantRow>> = {},
  variant: Partial<ProductFormValues["variants"][number]> = {},
) {
  function Harness() {
    const { register, control, setValue } = useForm<ProductFormValues>({
      defaultValues: {
        variants: [
          {
            sku: "",
            price: "10",
            compare_at_price: "",
            is_active: true,
            option_value_ids: [],
            ...variant,
          },
        ],
      },
    });
    const selected = useWatch({
      control,
      name: "variants.0.option_value_ids",
    });
    return (
      <>
        <output data-testid="selected-options">{selected?.join(",")}</output>
        <table dir="rtl">
          <tbody>
            <VariantRow
              index={0}
              fieldId="variant-1"
              register={register}
              control={control}
              setValue={setValue}
              optionTypes={[]}
              onRemove={vi.fn()}
              {...props}
            />
          </tbody>
        </table>
      </>
    );
  }
  return render(<Harness />);
}

describe("VariantRow as a grid row", () => {
  it("renders one addressable cell per editable field", () => {
    renderRow();

    expect(screen.getByRole("row")).toBeInTheDocument();
    expect(screen.getByRole("rowheader")).toHaveTextContent("تنوع 1");
    expect(screen.getByLabelText("انتخاب تنوع 1")).toHaveAttribute(
      "data-cell",
      cellAddress(0, "select"),
    );
    expect(screen.getByLabelText("SKU تنوع 1")).toHaveAttribute(
      "data-cell",
      cellAddress(0, "sku"),
    );
    expect(screen.getByLabelText("قیمت تنوع 1 به تومان")).toHaveAttribute(
      "data-cell",
      cellAddress(0, "price"),
    );
    expect(screen.getByLabelText("قیمت پیش از تخفیف تنوع 1")).toHaveAttribute(
      "data-cell",
      cellAddress(0, "compare_at_price"),
    );
    expect(
      screen.getByRole("switch", { name: "فعال بودن تنوع 1" }),
    ).toBeChecked();
  });

  it("shows the typed price grouped, without routing it through a float", () => {
    renderRow({}, { price: "18900000.50" });

    expect(screen.getByText("۱۸٬۹۰۰٬۰۰۰٫۵ تومان")).toBeInTheDocument();
  });

  it("reads option columns and edits them from the row's popover", async () => {
    renderRow({ optionTypes: [color] }, { option_value_ids: [10] });

    const cells = screen.getAllByRole("cell");
    expect(cells.some((cell) => cell.textContent === "قرمز")).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "ویرایش ویژگی‌های تنوع 1" }),
    );
    fireEvent.click(await screen.findByRole("combobox", { name: "رنگ" }));
    fireEvent.click(await screen.findByRole("option", { name: "آبی" }));

    expect(screen.getByTestId("selected-options")).toHaveTextContent("11");
  });

  it("surfaces per-cell validation state on the cell itself", () => {
    function Harness() {
      const { register, control, setValue, setError } =
        useForm<ProductFormValues>({
          defaultValues: {
            variants: [
              {
                sku: "DUP",
                price: "10",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [],
              },
            ],
          },
        });
      return (
        <>
          <button
            type="button"
            onClick={() =>
              setError("variants.0.sku", {
                type: "custom",
                message: "SKU هر تنوع باید یکتا باشد",
              })
            }
          >
            trigger
          </button>
          <table dir="rtl">
            <tbody>
              <VariantRow
                index={0}
                fieldId="variant-1"
                register={register}
                control={control}
                setValue={setValue}
                optionTypes={[]}
                onRemove={vi.fn()}
              />
            </tbody>
          </table>
        </>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "trigger" }));

    const sku = screen.getByLabelText("SKU تنوع 1");
    expect(sku).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "SKU هر تنوع باید یکتا باشد",
    );
    expect(sku).toHaveAttribute("aria-describedby", "variants.0.sku-error");
  });

  it("hides the stock control without inventory:write even when stock is loaded", () => {
    const inventory: InventoryItem = {
      id: 7,
      product_variant_id: 42,
      product_id: 1,
      product_title: "ویسکی",
      sku: "W-1",
      unit_price: "100000",
      missing_weight: false,
      stock_on_hand: 3,
      committed_stock: 1,
      available_stock: 2,
      reorder_point: 2,
      reorder_quantity: 6,
      updated_at: "2026-07-27T08:00:00Z",
    };
    renderRow({
      variantId: 42,
      isPersisted: true,
      availableStock: 2,
      inventory,
    });

    expect(
      screen.queryByRole("button", { name: "تنظیم موجودی ویسکی" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "۲" })).toHaveAttribute(
      "href",
      "/admin/inventory/42",
    );
  });

  it("links a persisted row's stock to the inventory ledger", () => {
    renderRow({ variantId: 42, isPersisted: true, availableStock: 3 });

    expect(screen.getByRole("link", { name: "۳" })).toHaveAttribute(
      "href",
      "/admin/inventory/42",
    );
  });

  /**
   * PE-11: stock is a ledger, so the grid posts a signed movement instead of
   * writing a level. `SaveProductAggregateReq` still carries no stock field —
   * an absolute overwrite from a product save would have no movement behind it
   * and would erase the audit trail.
   */
  it("adjusts stock as a ledger movement, not a field of the product save", async () => {
    mocks.mutateAsync.mockResolvedValue(null);
    const inventory: InventoryItem = {
      id: 7,
      product_variant_id: 42,
      product_id: 1,
      product_title: "ویسکی",
      sku: "W-1",
      unit_price: "100000",
      missing_weight: false,
      stock_on_hand: 3,
      committed_stock: 1,
      available_stock: 2,
      reorder_point: 2,
      reorder_quantity: 6,
      updated_at: "2026-07-27T08:00:00Z",
    };
    renderRow({
      variantId: 42,
      isPersisted: true,
      availableStock: 2,
      inventory,
      canAdjustStock: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "تنظیم موجودی ویسکی" }));
    fireEvent.click(await screen.findByRole("button", { name: "+۶" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ موجودی" }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        variantID: 42,
        input: expect.objectContaining({ quantity: 6, type: "restock" }),
      }),
    );
  });

  it("asks before removing a variant row", () => {
    const onRemove = vi.fn();
    renderRow({ onRemove }, { sku: "BLUE" });

    fireEvent.click(screen.getByRole("button", { name: "حذف تنوع 1" }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("BLUE");

    fireEvent.click(screen.getByRole("button", { name: "حذف تنوع" }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
