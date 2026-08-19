// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { ProductFormValues, VariantFormValues } from "../../validations";
import { VariantTable } from "./VariantTable";

// The stock adjustment posts through a "use server" action; Next breaks that
// import chain at the boundary, Vitest needs it stubbed (PE-11).
vi.mock("@/features/inventory/actions", () => ({
  adjustVariantStockAction: vi.fn(),
  updateVariantReorderAction: vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

const volume: ProductOptionGroup = {
  id: 3,
  title: "volume",
  display_name: "حجم",
  created_at: "2026-07-27T00:00:00Z",
  updated_at: "2026-07-27T00:00:00Z",
  values: [
    {
      id: 11,
      option_type_id: 3,
      value: "700ml",
      sort_order: 0,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
    },
    {
      id: 12,
      option_type_id: 3,
      value: "1000ml",
      sort_order: 1,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
    },
    {
      id: 13,
      option_type_id: 3,
      value: "قوطی",
      sort_order: 2,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
    },
  ],
};

function variant(over: Partial<VariantFormValues> = {}): VariantFormValues {
  return {
    sku: "",
    price: "",
    compare_at_price: "",
    is_active: true,
    option_value_ids: [],
    ...over,
  };
}

function Harness({
  variants,
  code = "BLK",
  optionTypes = [volume],
}: {
  variants: VariantFormValues[];
  code?: string;
  optionTypes?: ProductOptionGroup[];
}) {
  const { register, control, setValue, getValues } = useForm<ProductFormValues>(
    { defaultValues: { code, variants } },
  );
  const { fields, remove } = useFieldArray({ control, name: "variants" });
  const [snapshot, setSnapshot] = React.useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => setSnapshot(JSON.stringify(getValues("variants")))}
      >
        snapshot
      </button>
      <output data-testid="snapshot">{snapshot}</output>
      <VariantTable
        register={register}
        control={control}
        setValue={setValue}
        getValues={getValues}
        fields={fields}
        remove={remove}
        optionTypes={optionTypes}
      />
    </>
  );
}

function snapshot(): VariantFormValues[] {
  fireEvent.click(screen.getByRole("button", { name: "snapshot" }));
  return JSON.parse(screen.getByTestId("snapshot").textContent || "[]");
}

describe("VariantTable structure", () => {
  it("is a real table with a header cell per column", () => {
    render(<Harness variants={[variant()]} />);

    expect(screen.getByRole("table")).toHaveAttribute("dir", "rtl");
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual([
      "",
      "تنوع",
      "حجم",
      "SKU",
      "قیمت (تومان)",
      "قیمت پیش از تخفیف",
      "موجودی",
      "وضعیت",
      "عملیات",
    ]);
    expect(screen.getAllByRole("rowheader")).toHaveLength(1);
  });
});

describe("VariantTable inline editing", () => {
  it("persists a cell edit to form state without remounting the row", () => {
    render(<Harness variants={[variant(), variant()]} />);

    const price = screen.getByLabelText("قیمت تنوع 2 به تومان");
    fireEvent.change(price, { target: { value: "1250000" } });

    // Same DOM node before and after: a row that remounted would drop focus
    // on every keystroke, which is exactly what the accordion did not do.
    expect(screen.getByLabelText("قیمت تنوع 2 به تومان")).toBe(price);
    expect(snapshot()[1]?.price).toBe("1250000");
    expect(snapshot()[0]?.price).toBe("");
  });
});

describe("VariantTable apply to selected", () => {
  it("writes exactly the selected rows", async () => {
    render(<Harness variants={[variant(), variant(), variant()]} />);

    fireEvent.click(screen.getByLabelText("انتخاب تنوع 1"));
    fireEvent.click(screen.getByLabelText("انتخاب تنوع 3"));
    fireEvent.click(
      screen.getByRole("button", { name: /اعمال روی انتخاب‌شده‌ها/ }),
    );
    fireEvent.change(await screen.findByLabelText("مقدار"), {
      target: { value: "990000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /اعمال بر ۲ تنوع/ }));

    expect(snapshot().map((row) => row.price)).toEqual([
      "990000",
      "",
      "990000",
    ]);
  });

  it("keeps the selection on the right row after a delete", () => {
    render(
      <Harness
        variants={[
          variant({ sku: "FIRST" }),
          variant({ sku: "SECOND" }),
          variant({ sku: "THIRD" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText("انتخاب تنوع 2"));
    fireEvent.click(screen.getByRole("button", { name: "حذف تنوع 1" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف تنوع" }));

    // SECOND is row 1 now; selection followed the row, not the index.
    expect(screen.getByLabelText("SKU تنوع 1")).toHaveValue("SECOND");
    expect(screen.getByLabelText("انتخاب تنوع 1")).toBeChecked();
    expect(screen.getByLabelText("انتخاب تنوع 2")).not.toBeChecked();
  });
});

describe("VariantTable fill down", () => {
  it("propagates the focused cell to the rows beneath it only", () => {
    render(
      <Harness
        variants={[
          variant({ price: "100" }),
          variant({ price: "200" }),
          variant(),
          variant(),
        ]}
      />,
    );

    act(() => screen.getByLabelText("قیمت تنوع 2 به تومان").focus());
    fireEvent.click(screen.getByRole("button", { name: /پر کردن به پایین/ }));

    expect(snapshot().map((row) => row.price)).toEqual([
      "100",
      "200",
      "200",
      "200",
    ]);
  });

  it("fills down from the keyboard too", () => {
    render(
      <Harness variants={[variant({ price: "50" }), variant(), variant()]} />,
    );

    const cell = screen.getByLabelText("قیمت تنوع 1 به تومان");
    cell.focus();
    fireEvent.keyDown(cell, { key: "d", ctrlKey: true });

    expect(snapshot().map((row) => row.price)).toEqual(["50", "50", "50"]);
  });

  it("stays disabled on the last row, which has nothing beneath it", () => {
    render(<Harness variants={[variant({ price: "50" }), variant()]} />);
    const button = screen.getByRole("button", { name: /پر کردن به پایین/ });

    act(() => screen.getByLabelText("قیمت تنوع 1 به تومان").focus());
    expect(button).toBeEnabled();

    act(() => screen.getByLabelText("قیمت تنوع 2 به تومان").focus());
    expect(button).toBeDisabled();

    // SKU is deliberately not fillable: copying one down guarantees a
    // duplicate, which the schema rejects for the whole product.
    act(() => screen.getByLabelText("SKU تنوع 1").focus());
    expect(button).toBeDisabled();
  });
});

describe("VariantTable keyboard traversal", () => {
  it("moves cell focus right-to-left with the arrow keys", () => {
    render(<Harness variants={[variant(), variant()]} />);

    const sku = screen.getByLabelText("SKU تنوع 1");
    sku.focus();

    // RTL: the next column is to the visual left.
    fireEvent.keyDown(sku, { key: "ArrowLeft" });
    expect(screen.getByLabelText("قیمت تنوع 1 به تومان")).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(sku).toHaveFocus();

    fireEvent.keyDown(sku, { key: "ArrowDown" });
    expect(screen.getByLabelText("SKU تنوع 2")).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(sku).toHaveFocus();
  });

  it("does not escape a cell while the caret still has somewhere to go", () => {
    render(<Harness variants={[variant({ sku: "ABCDEF" })]} />);

    const sku = screen.getByLabelText("SKU تنوع 1") as HTMLInputElement;
    sku.focus();
    sku.setSelectionRange(3, 3);
    fireEvent.keyDown(sku, { key: "ArrowLeft" });

    expect(sku).toHaveFocus();
  });
});

describe("VariantTable SKU generation", () => {
  it("names blank rows uniquely and leaves typed SKUs alone", () => {
    render(
      <Harness
        variants={[
          variant({ option_value_ids: [11], sku: "KEEP-ME" }),
          variant({ option_value_ids: [12] }),
          variant({ option_value_ids: [13] }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ساخت خودکار SKU/ }));

    expect(snapshot().map((row) => row.sku)).toEqual([
      "KEEP-ME",
      "BLK-1000ML",
      "BLK-V13",
    ]);
    expect(screen.getByText(/۲ SKU ساخته شد/)).toBeInTheDocument();
  });

  it("only names the selected rows when there is a selection", () => {
    render(
      <Harness
        variants={[
          variant({ option_value_ids: [11] }),
          variant({ option_value_ids: [12] }),
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText("انتخاب تنوع 2"));
    fireEvent.click(screen.getByRole("button", { name: /ساخت خودکار SKU/ }));

    expect(snapshot().map((row) => row.sku)).toEqual(["", "BLK-1000ML"]);
  });

  it("refuses to invent an SKU before the product has a code", () => {
    render(<Harness code="" variants={[variant()]} />);

    fireEvent.click(screen.getByRole("button", { name: /ساخت خودکار SKU/ }));

    expect(
      screen.getByText(/ابتدا «کد محصول» را کامل کنید/),
    ).toBeInTheDocument();
    expect(snapshot()[0]?.sku).toBe("");
  });
});
