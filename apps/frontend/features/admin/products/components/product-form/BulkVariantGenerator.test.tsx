// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductOptionGroup } from "@/features/admin/products/types";
import { BulkVariantGenerator } from "./BulkVariantGenerator";

afterEach(cleanup);

function optionGroup(
  id: number,
  displayName: string,
  values: Array<[number, string]>,
): ProductOptionGroup {
  return {
    id,
    title: `option-${id}`,
    display_name: displayName,
    created_at: "2026-07-27T00:00:00Z",
    updated_at: "2026-07-27T00:00:00Z",
    values: values.map(([valueId, value], sortOrder) => ({
      id: valueId,
      option_type_id: id,
      value,
      sort_order: sortOrder,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
    })),
  };
}

describe("BulkVariantGenerator", () => {
  it("builds the Cartesian product and skips combinations that already exist", () => {
    const onGenerate = vi.fn();
    const optionTypes = [
      optionGroup(1, "رنگ", [
        [10, "قرمز"],
        [11, "آبی"],
      ]),
      optionGroup(2, "حجم", [
        [20, "۵۰۰ میلی‌لیتر"],
        [21, "۷۵۰ میلی‌لیتر"],
      ]),
    ];

    render(
      <BulkVariantGenerator
        optionTypes={optionTypes}
        existingCombinations={[[10, 20]]}
        onGenerate={onGenerate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ساخت گروهی تنوع‌ها/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /رنگ/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /حجم/ }));
    fireEvent.change(screen.getByLabelText("قیمت پایه (تومان)"), {
      target: { value: "1250000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت ۴ ترکیب" }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        price: "1250000",
        option_value_ids: [10, 21],
      }),
      expect.objectContaining({
        price: "1250000",
        option_value_ids: [11, 20],
      }),
      expect.objectContaining({
        price: "1250000",
        option_value_ids: [11, 21],
      }),
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("۳ تنوع تازه");
  });

  it("blocks an accidental variant explosion", () => {
    const firstValues = Array.from({ length: 11 }, (_, index) => [
      100 + index,
      `A${index}`,
    ]) as Array<[number, string]>;
    const secondValues = Array.from({ length: 10 }, (_, index) => [
      200 + index,
      `B${index}`,
    ]) as Array<[number, string]>;

    render(
      <BulkVariantGenerator
        optionTypes={[
          optionGroup(1, "بعد اول", firstValues),
          optionGroup(2, "بعد دوم", secondValues),
        ]}
        existingCombinations={[]}
        onGenerate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ساخت گروهی تنوع‌ها/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /بعد اول/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /بعد دوم/ }));
    fireEvent.change(screen.getByLabelText("قیمت پایه (تومان)"), {
      target: { value: "100" },
    });

    expect(
      screen.getByRole("button", { name: "ساخت ۱۱۰ ترکیب" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("بیشتر از ۱۰۰");
  });
});
