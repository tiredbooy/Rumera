// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useForm, useWatch } from "react-hook-form";

import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { ProductFormValues } from "../../validations";
import { VariantRow } from "./VariantRow";

afterEach(cleanup);

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("VariantRow responsive layout", () => {
  it("stacks fields on narrow screens and expands only at wider breakpoints", () => {
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
            },
          ],
        },
      });
      return (
        <VariantRow
          index={0}
          fieldId="variant-1"
          register={register}
          control={control}
          setValue={setValue}
          errors={{}}
          optionTypes={[]}
          defaultOpen
          onRemove={vi.fn()}
        />
      );
    }

    render(<Harness />);

    const removeButton = screen.getByRole("button", { name: "حذف تنوع 1" });
    const header = removeButton.parentElement;
    const row = header?.parentElement;

    expect(header).toHaveClass(
      "grid-cols-[minmax(0,1fr)_auto_auto]",
      "md:grid-cols-[minmax(0,1.4fr)_minmax(100px,.6fr)_minmax(130px,.7fr)_auto_auto]",
    );
    expect(row).toHaveClass("min-w-0", "overflow-hidden");
    expect(row).toHaveAccessibleName("تنوع 1: بدون ویژگی");
    expect(screen.getByLabelText("SKU").parentElement).toHaveClass(
      "min-w-0",
      "sm:col-span-2",
      "xl:col-span-1",
    );
    expect(removeButton).toHaveClass("size-11");
    expect(
      screen.getByRole("switch", { name: "فعال بودن تنوع 1" }),
    ).toBeChecked();
  });

  it("renders hydrated variant media and replaces one value within an option type", async () => {
    const optionTypes: ProductOptionGroup[] = [
      {
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
      },
    ];

    function Harness() {
      const { register, control, setValue } = useForm<ProductFormValues>({
        defaultValues: {
          variants: [
            {
              sku: "BLUE",
              price: "10",
              compare_at_price: "",
              is_active: true,
              option_value_ids: [10],
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
          <VariantRow
            index={0}
            fieldId="variant-1"
            register={register}
            control={control}
            setValue={setValue}
            errors={{}}
            optionTypes={optionTypes}
            availableStock={3}
            isPersisted
            defaultOpen
            images={[
              {
                id: 2,
                image_url: "/media/variant.webp",
                sort_order: 0,
                is_primary: false,
              },
            ]}
            onRemove={vi.fn()}
          />
          <output data-testid="selected-options">{selected?.join(",")}</output>
        </>
      );
    }

    render(<Harness />);

    expect(screen.getByText("۱ تصویر اختصاصی")).toBeInTheDocument();
    expect(screen.getAllByText("موجودی: ۳").length).toBeGreaterThan(0);
    const color = screen.getByRole("combobox", { name: "رنگ" });
    expect(color).toHaveTextContent("قرمز");

    fireEvent.click(color);
    fireEvent.click(await screen.findByRole("option", { name: "آبی" }));

    expect(screen.getByTestId("selected-options")).toHaveTextContent("11");
    expect(
      screen.getByRole("switch", { name: "فعال بودن تنوع 1" }),
    ).toBeChecked();
  });
});
