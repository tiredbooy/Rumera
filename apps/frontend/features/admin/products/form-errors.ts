import type { FieldErrors } from "react-hook-form";

import type { ProductFormValues } from "./validations";

/**
 * One line of the pre-save error summary (PE-6).
 *
 * `targetId` is the DOM id the jump link focuses. Every product field uses its
 * own form path as its element id, and a variant cell uses `variants.N.column`,
 * so the two stay in step without a second registry to drift out of date.
 */
export type ProductFormErrorEntry = {
  key: string;
  label: string;
  message: string;
  targetId?: string;
};

/** Fields rendered above the variant grid, in the order the operator sees them. */
const FIELDS_BEFORE_VARIANTS: Array<
  [keyof ProductFormValues, string, string?]
> = [
  ["title", "نام محصول"],
  ["slug", "نامک"],
  ["code", "کد محصول"],
  ["category_id", "دسته‌بندی"],
  ["brand_id", "برند"],
  ["country_of_origin", "کشور سازنده"],
  ["description", "توضیحات"],
  ["abv", "درصد الکل"],
  ["weight", "وزن"],
  ["tag_ids", "برچسب‌ها", "product-tags-trigger"],
];

const FIELDS_AFTER_VARIANTS: Array<[keyof ProductFormValues, string, string?]> =
  [
    ["meta_title", "عنوان سئو"],
    ["meta_description", "توضیحات سئو"],
    ["meta_tags", "کلیدواژه‌های سئو"],
  ];

/** Editable variant columns, in column order. Matches `VARIANT_CELL_COLUMNS`. */
const VARIANT_COLUMNS = [
  ["sku", "SKU"],
  ["price", "قیمت"],
  ["compare_at_price", "قیمت پیش از تخفیف"],
  ["option_value_ids", "ویژگی‌ها"],
] as const;

function messageOf(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() !== ""
    ? message
    : undefined;
}

/**
 * Flatten react-hook-form errors into the summary's reading order.
 *
 * The variant grid puts `aria-invalid` and an inline alert on every bad cell,
 * which is invisible when 64 rows are off-screen — so each one is named by its
 * row and column here rather than summarised as "a variant is invalid" (PE-6).
 */
export function collectProductFormErrors(
  errors: FieldErrors<ProductFormValues>,
): ProductFormErrorEntry[] {
  const entries: ProductFormErrorEntry[] = [];

  const push = (
    key: string,
    label: string,
    message: string | undefined,
    targetId?: string,
  ) => {
    if (message) entries.push({ key, label, message, targetId });
  };

  for (const [name, label, targetId] of FIELDS_BEFORE_VARIANTS) {
    push(name, label, messageOf(errors[name]), targetId ?? name);
  }

  const variants = errors.variants;
  push(
    "variants",
    "تنوع‌ها",
    messageOf(variants) ?? messageOf(variants?.root),
    "product-variants-trigger",
  );
  if (Array.isArray(variants)) {
    variants.forEach((row, index) => {
      if (!row) return;
      for (const [column, columnLabel] of VARIANT_COLUMNS) {
        const path = `variants.${index}.${column}`;
        push(
          path,
          `تنوع ${index + 1} — ${columnLabel}`,
          messageOf(row[column]),
          path,
        );
      }
    });
  }

  for (const [name, label, targetId] of FIELDS_AFTER_VARIANTS) {
    push(name, label, messageOf(errors[name]), targetId ?? name);
  }

  // The publish switch lives in the sticky action bars, which have no single
  // stable target to jump to — list it, but without a dead link.
  push("is_active", "وضعیت انتشار", messageOf(errors.is_active));

  return entries;
}
