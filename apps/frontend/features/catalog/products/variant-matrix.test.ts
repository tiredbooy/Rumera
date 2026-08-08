import { describe, expect, it } from "vitest";

import type { ProductVariant } from "@/features/catalog/products/types";
import {
  buildVariantAxes,
  findVariantForSelection,
  isOptionValueAvailable,
  selectionFromVariant,
} from "./variant-matrix";

function variant(
  id: number,
  options: { typeId: number; type: string; value: string }[],
  stock = 5,
): ProductVariant {
  return {
    id,
    price: 1000 * id,
    is_active: true,
    available_stock: stock,
    options: options.map((option, index) => ({
      id: index + 1,
      option_type_id: option.typeId,
      option_type_title: option.type,
      option_type: option.type,
      value: option.value,
    })),
  };
}

describe("variant-matrix", () => {
  const variants = [
    variant(1, [
      { typeId: 1, type: "حجم", value: "۷۰۰" },
      { typeId: 2, type: "بسته", value: "تک" },
    ]),
    variant(2, [
      { typeId: 1, type: "حجم", value: "۷۰۰" },
      { typeId: 2, type: "بسته", value: "جعبه" },
    ]),
    variant(
      3,
      [
        { typeId: 1, type: "حجم", value: "۱۰۰۰" },
        { typeId: 2, type: "بسته", value: "تک" },
      ],
      0,
    ),
  ];

  it("builds multi-axis option groups", () => {
    const axes = buildVariantAxes(variants);
    expect(axes).toHaveLength(2);
    expect(axes[0]?.values).toEqual(expect.arrayContaining(["۷۰۰", "۱۰۰۰"]));
    expect(axes[1]?.values).toEqual(expect.arrayContaining(["تک", "جعبه"]));
  });

  it("resolves a variant from a full selection", () => {
    const axes = buildVariantAxes(variants);
    const selection = selectionFromVariant(variants[1], axes);
    expect(findVariantForSelection(variants, selection)?.id).toBe(2);
  });

  it("marks stock-out combinations as unavailable for stock-aware checks", () => {
    const selection = { "id:1": "۱۰۰۰", "id:2": "تک" };
    expect(
      isOptionValueAvailable(variants, selection, "id:1", "۱۰۰۰", true),
    ).toBe(false);
    expect(
      isOptionValueAvailable(variants, selection, "id:1", "۷۰۰", true),
    ).toBe(true);
  });
});
