import { describe, expect, it } from "vitest";

import type { ProductDetail } from "@/features/catalog/products/types";
import { getDefaultFormValues, productFormSchema } from "./validations";

function formValues() {
  return {
    title: "محصول",
    slug: "",
    code: "",
    description: "",
    category_id: "",
    brand_id: "",
    country_of_origin: "",
    abv: "",
    weight: "",
    is_active: true,
    meta_title: "",
    meta_description: "",
    meta_tags: "",
    tag_ids: [] as number[],
    variants: [
      {
        sku: "Bottle-Red",
        price: "100",
        compare_at_price: "",
        is_active: true,
        option_value_ids: [2, 1],
      },
      {
        sku: "Bottle-Blue",
        price: "110",
        compare_at_price: "",
        is_active: true,
        option_value_ids: [2, 3],
      },
    ],
  };
}

describe("product variant validation", () => {
  it("rejects case-insensitive duplicate SKUs on every conflicting row", () => {
    const values = formValues();
    values.variants[1].sku = "  bottle-red  ";

    const result = productFormSchema.safeParse(values);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.filter((issue) => issue.path.at(-1) === "sku"),
    ).toHaveLength(2);
  });

  it("rejects duplicate non-empty combinations regardless of value order", () => {
    const values = formValues();
    values.variants[1].option_value_ids = [1, 2];

    const result = productFormSchema.safeParse(values);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.filter(
        (issue) => issue.path.at(-1) === "option_value_ids",
      ),
    ).toHaveLength(2);
  });

  it("allows multiple SKU-only variants without fabricated option combinations", () => {
    const values = formValues();
    values.variants[0].option_value_ids = [];
    values.variants[1].option_value_ids = [];

    expect(productFormSchema.safeParse(values).success).toBe(true);
  });

  it("requires compare-at price to exceed the sale price", () => {
    const values = formValues();
    values.variants[0].compare_at_price = "100";

    const result = productFormSchema.safeParse(values);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["variants", 0, "compare_at_price"],
        message: "قیمت پیش از تخفیف باید بیشتر از قیمت فروش باشد",
      }),
    );

    values.variants[0].compare_at_price = "101";
    expect(productFormSchema.safeParse(values).success).toBe(true);
  });

  it("rejects non-finite numeric values before JSON serialization", () => {
    const values = formValues();
    values.variants[0].price = "Infinity";
    values.weight = "Infinity";

    const result = productFormSchema.safeParse(values);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["variants.0.price", "weight"]),
    );
  });

  it("starts new products as drafts", () => {
    expect(getDefaultFormValues().is_active).toBe(false);
  });

  it("hydrates persisted option IDs into edit-form defaults", () => {
    const product: ProductDetail = {
      id: 9,
      title: "محصول",
      is_active: true,
      variants: [
        {
          id: 12,
          sku: "BOTTLE-RED",
          price: 100,
          is_active: true,
          options: [
            {
              id: 7,
              option_type_id: 3,
              option_type_title: "color",
              option_type: "رنگ",
              value: "قرمز",
            },
          ],
        },
      ],
    };

    expect(getDefaultFormValues(product).variants[0]).toEqual(
      expect.objectContaining({ _id: 12, option_value_ids: [7] }),
    );
  });
});
