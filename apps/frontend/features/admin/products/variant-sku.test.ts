import { describe, expect, it } from "vitest";

import type { ProductOptionGroup } from "./types";
import {
  buildVariantSku,
  generateVariantSkus,
  optionValueSlug,
  skuPrefix,
} from "./variant-sku";

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

const volume = optionGroup(1, "حجم", [
  [10, "750ml"],
  [11, "۱ لیتر"],
]);
const color = optionGroup(2, "رنگ", [
  [20, "قرمز"],
  [21, "Blue"],
]);

describe("optionValueSlug", () => {
  it("folds Eastern digits and punctuation into an ASCII segment", () => {
    expect(optionValueSlug({ id: 10, value: "750ml" })).toBe("750ML");
    expect(optionValueSlug({ id: 30, value: "۵۰۰ ml" })).toBe("500-ML");
    expect(optionValueSlug({ id: 31, value: " Extra  Dry " })).toBe(
      "EXTRA-DRY",
    );
  });

  it("falls back to the value id when the label has no ASCII to keep", () => {
    // Two Persian labels would otherwise both slug to "", collapsing distinct
    // combinations onto one SKU.
    expect(optionValueSlug({ id: 20, value: "قرمز" })).toBe("V20");
    expect(optionValueSlug({ id: 22, value: "آبی" })).toBe("V22");
  });
});

describe("buildVariantSku", () => {
  it("orders segments by option type, not by pick order", () => {
    expect(buildVariantSku("BLK", [21, 10], [volume, color])).toBe(
      "BLK-750ML-BLUE",
    );
    expect(buildVariantSku("BLK", [10, 21], [volume, color])).toBe(
      "BLK-750ML-BLUE",
    );
  });

  it("is just the code when no option is chosen", () => {
    expect(buildVariantSku("BLK", [], [volume, color])).toBe("BLK");
  });
});

describe("skuPrefix", () => {
  it("normalises the product code and rejects a blank one", () => {
    expect(skuPrefix(" blk 12 ")).toBe("BLK-12");
    expect(skuPrefix("۱۲۳")).toBe("123");
    expect(skuPrefix("   ")).toBeNull();
    expect(skuPrefix("،،")).toBeNull();
  });
});

describe("generateVariantSkus", () => {
  const variants = [
    { sku: "", option_value_ids: [10, 20] },
    { sku: "", option_value_ids: [10, 21] },
    { sku: "", option_value_ids: [11, 20] },
  ];

  it("names every blank row uniquely from the code and the option slugs", () => {
    const generated = generateVariantSkus("blk", [volume, color], variants);

    expect([...generated.entries()]).toEqual([
      [0, "BLK-750ML-V20"],
      [1, "BLK-750ML-BLUE"],
      [2, "BLK-1-V20"],
    ]);
  });

  it("never overwrites an SKU the operator typed", () => {
    const typed = [
      { sku: "HAND-PICKED", option_value_ids: [10, 20] },
      ...variants.slice(1),
    ];
    const generated = generateVariantSkus("blk", [volume, color], typed);

    expect(generated.has(0)).toBe(false);
    expect([...generated.keys()]).toEqual([1, 2]);
  });

  it("suffixes a candidate that would collide with an existing SKU", () => {
    const collides = [
      { sku: "BLK-750ML-V20", option_value_ids: [10, 20] },
      { sku: "", option_value_ids: [10, 20] },
      { sku: "", option_value_ids: [10, 20] },
    ];
    const generated = generateVariantSkus("blk", [volume, color], collides);

    expect(generated.get(1)).toBe("BLK-750ML-V20-2");
    expect(generated.get(2)).toBe("BLK-750ML-V20-3");
  });

  it("only touches the rows it was pointed at", () => {
    const generated = generateVariantSkus(
      "blk",
      [volume, color],
      variants,
      [2],
    );
    expect([...generated.keys()]).toEqual([2]);
  });

  it("generates nothing when the product has no code yet", () => {
    expect(generateVariantSkus("  ", [volume, color], variants).size).toBe(0);
  });
});
