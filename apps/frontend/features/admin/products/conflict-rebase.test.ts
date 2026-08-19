import { describe, expect, it } from "vitest";

import { rebaseProductForm } from "./conflict-rebase";
import { getDefaultFormValues, type ProductFormValues } from "./validations";

const base: ProductFormValues = {
  ...getDefaultFormValues(),
  title: "ویسکی",
  slug: "whisky",
  description: "توضیح اولیه",
  tag_ids: [1],
  variants: [
    {
      _id: 11,
      sku: "W-1",
      price: "100",
      compare_at_price: "",
      is_active: true,
      option_value_ids: [201],
    },
  ],
};

const clone = (values: ProductFormValues): ProductFormValues =>
  structuredClone(values);

describe("rebaseProductForm", () => {
  it("keeps the colleague's change on a field the operator never touched", () => {
    const mine = { ...clone(base), title: "ویسکی تازه" };
    const theirs = { ...clone(base), description: "توضیح همکار" };

    const { values, overwritten } = rebaseProductForm(base, mine, theirs);

    expect(values.title).toBe("ویسکی تازه");
    expect(values.description).toBe("توضیح همکار");
    expect(overwritten).toEqual([]);
  });

  it("keeps the operator's value on a field both changed and reports it", () => {
    const mine = { ...clone(base), title: "نام من" };
    const theirs = { ...clone(base), title: "نام همکار" };

    const { values, overwritten } = rebaseProductForm(base, mine, theirs);

    expect(values.title).toBe("نام من");
    expect(overwritten).toEqual(["نام محصول"]);
  });

  it("keeps staged tags and reports a concurrent tag change", () => {
    const mine = { ...clone(base), tag_ids: [1, 2] };
    const theirs = { ...clone(base), tag_ids: [3] };

    const { values, overwritten } = rebaseProductForm(base, mine, theirs);

    expect(values.tag_ids).toEqual([1, 2]);
    expect(overwritten).toEqual(["برچسب‌ها"]);
  });

  it("keeps staged variants, adopts the colleague's new row and honours deletes", () => {
    const mine = clone(base);
    mine.variants[0].option_value_ids = [202];
    mine.variants.push({
      sku: "NEW",
      price: "120",
      compare_at_price: "",
      is_active: true,
      option_value_ids: [],
    });
    const theirs = clone(base);
    theirs.variants.push({
      _id: 12,
      sku: "THEIRS",
      price: "150",
      compare_at_price: "",
      is_active: true,
      option_value_ids: [203],
    });

    const { values, overwritten, droppedVariants } = rebaseProductForm(
      base,
      mine,
      theirs,
    );

    expect(values.variants).toEqual([
      expect.objectContaining({ _id: 11, option_value_ids: [202] }),
      expect.objectContaining({ _id: 12, sku: "THEIRS" }),
      expect.objectContaining({ sku: "NEW" }),
    ]);
    expect(overwritten).toEqual([]);
    expect(droppedVariants).toBe(0);
  });

  it("drops rows the colleague deleted instead of re-sending a stale ID", () => {
    const mine = clone(base);
    mine.variants[0].price = "130";
    const theirs = { ...clone(base), variants: [] };

    const { values, droppedVariants } = rebaseProductForm(base, mine, theirs);

    expect(values.variants).toEqual([]);
    expect(droppedVariants).toBe(1);
  });

  it("reports a row both editors changed", () => {
    const mine = clone(base);
    mine.variants[0].price = "130";
    const theirs = clone(base);
    theirs.variants[0].price = "140";

    const { values, overwritten } = rebaseProductForm(base, mine, theirs);

    expect(values.variants[0]?.price).toBe("130");
    expect(overwritten).toEqual(["تنوع‌ها"]);
  });

  it("drops a row the operator deleted even though the colleague changed it", () => {
    const mine = { ...clone(base), variants: [] };
    const theirs = clone(base);
    theirs.variants[0].price = "140";

    const { values } = rebaseProductForm(base, mine, theirs);

    expect(values.variants).toEqual([]);
  });
});
