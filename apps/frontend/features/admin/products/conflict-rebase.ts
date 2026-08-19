import type { ProductFormValues, VariantFormValues } from "./validations";

/**
 * Three-way rebase for the product editor (PE-2).
 *
 * A 409 means the row moved under the operator. Resubmitting their whole
 * payload against the fresh revision would silently erase the colleague's
 * work, so every field is decided against the revision the operator loaded:
 * fields they never touched keep the colleague's value, fields they edited
 * keep theirs — and the overlap is reported instead of resolved in silence.
 */

type ScalarKey = Exclude<keyof ProductFormValues, "tag_ids" | "variants">;

const SCALAR_LABELS: Record<ScalarKey, string> = {
  title: "نام محصول",
  slug: "نامک",
  code: "کد محصول",
  description: "توضیحات",
  category_id: "دسته‌بندی",
  brand_id: "برند",
  country_of_origin: "کشور سازنده",
  abv: "درصد الکل",
  weight: "وزن",
  is_active: "وضعیت انتشار",
  meta_title: "عنوان سئو",
  meta_description: "توضیحات سئو",
  meta_tags: "کلیدواژه‌ها",
};

const SCALAR_KEYS = Object.keys(SCALAR_LABELS) as ScalarKey[];

export type ProductRebase = {
  /** The operator's edits re-applied on top of the colleague's revision. */
  values: ProductFormValues;
  /** Labels of fields both editors changed — the operator's value wins. */
  overwritten: string[];
  /** Rows the operator edited that the colleague deleted; dropped from the payload. */
  droppedVariants: number;
};

const tagKey = (ids: number[]) =>
  [...ids].sort((left, right) => left - right).join(",");

const variantKey = (variant: VariantFormValues) =>
  JSON.stringify([
    variant.sku,
    variant.price,
    variant.compare_at_price,
    variant.is_active,
    [...variant.option_value_ids].sort((left, right) => left - right),
  ]);

export function rebaseProductForm(
  /** Values as the operator loaded them — the common ancestor. */
  base: ProductFormValues,
  /** What the operator has in the form right now. */
  mine: ProductFormValues,
  /** The revision the colleague just saved. */
  theirs: ProductFormValues,
): ProductRebase {
  const overwritten: string[] = [];
  const values = { ...theirs } as ProductFormValues;

  for (const key of SCALAR_KEYS) {
    if (mine[key] === base[key]) continue;
    Object.assign(values, { [key]: mine[key] });
    if (theirs[key] !== base[key] && theirs[key] !== mine[key]) {
      overwritten.push(SCALAR_LABELS[key]);
    }
  }

  if (tagKey(mine.tag_ids) !== tagKey(base.tag_ids)) {
    values.tag_ids = mine.tag_ids;
    if (
      tagKey(theirs.tag_ids) !== tagKey(base.tag_ids) &&
      tagKey(theirs.tag_ids) !== tagKey(mine.tag_ids)
    ) {
      overwritten.push("برچسب‌ها");
    }
  }

  const byID = (variants: VariantFormValues[]) =>
    new Map(
      variants
        .filter((variant) => variant._id != null)
        .map((variant) => [variant._id as number, variant]),
    );
  const baseVariants = byID(base.variants);
  const myVariants = byID(mine.variants);
  const theirVariants = byID(theirs.variants);

  let variantOverlap = false;
  const merged: VariantFormValues[] = [];
  for (const variant of theirs.variants) {
    const id = variant._id;
    if (id == null) continue;
    const ancestor = baseVariants.get(id);
    // A row the colleague added: the operator never saw it, so keep it.
    if (!ancestor) {
      merged.push(variant);
      continue;
    }
    const ours = myVariants.get(id);
    // The operator deleted this row — honour the delete.
    if (!ours) continue;
    if (variantKey(ours) === variantKey(ancestor)) {
      merged.push(variant);
      continue;
    }
    merged.push(ours);
    variantOverlap ||= variantKey(variant) !== variantKey(ancestor);
  }
  // Rows the operator added locally have no server ID yet.
  merged.push(...mine.variants.filter((variant) => variant._id == null));
  if (variantOverlap) overwritten.push("تنوع‌ها");

  // Rows the colleague deleted: the server rejects a payload that still
  // references them, so they cannot be re-applied.
  const droppedVariants = mine.variants.filter(
    (variant) => variant._id != null && !theirVariants.has(variant._id),
  ).length;

  values.variants = merged;
  return { values, overwritten, droppedVariants };
}
