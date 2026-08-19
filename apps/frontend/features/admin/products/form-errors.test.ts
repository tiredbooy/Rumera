import { describe, expect, it } from "vitest";
import type { FieldErrors } from "react-hook-form";

import { collectProductFormErrors } from "./form-errors";
import type { ProductFormValues } from "./validations";

const asErrors = (value: unknown) => value as FieldErrors<ProductFormValues>;

describe("collectProductFormErrors", () => {
  it("reports nothing for a clean form", () => {
    expect(collectProductFormErrors(asErrors({}))).toEqual([]);
  });

  it("names the variant row and column, not just «a variant»", () => {
    const entries = collectProductFormErrors(
      asErrors({
        variants: [
          undefined,
          {
            sku: { message: "SKU هر تنوع باید یکتا باشد" },
            price: { message: "قیمت معتبر وارد کنید" },
          },
        ],
      }),
    );

    expect(entries).toEqual([
      {
        key: "variants.1.sku",
        label: "تنوع 2 — SKU",
        message: "SKU هر تنوع باید یکتا باشد",
        targetId: "variants.1.sku",
      },
      {
        key: "variants.1.price",
        label: "تنوع 2 — قیمت",
        message: "قیمت معتبر وارد کنید",
        targetId: "variants.1.price",
      },
    ]);
  });

  it("lists failures in the order the operator scrolls through them", () => {
    const entries = collectProductFormErrors(
      asErrors({
        meta_title: { message: "عنوان سئو معتبر نیست" },
        variants: [{ price: { message: "قیمت معتبر وارد کنید" } }],
        slug: { message: "برای انتشار، نامک الزامی است" },
      }),
    );

    expect(entries.map((entry) => entry.key)).toEqual([
      "slug",
      "variants.0.price",
      "meta_title",
    ]);
  });

  it("points a section-level variant failure at the section, not a cell", () => {
    const entries = collectProductFormErrors(
      asErrors({ variants: { message: "حداقل یک تنوع لازم است" } }),
    );

    expect(entries).toEqual([
      {
        key: "variants",
        label: "تنوع‌ها",
        message: "حداقل یک تنوع لازم است",
        targetId: "product-variants-trigger",
      },
    ]);
  });

  it("still lists the publish switch, which has no field to jump to", () => {
    const [entry] = collectProductFormErrors(
      asErrors({ is_active: { message: "قابل انتشار نیست" } }),
    );

    expect(entry).toMatchObject({ key: "is_active", targetId: undefined });
  });
});
