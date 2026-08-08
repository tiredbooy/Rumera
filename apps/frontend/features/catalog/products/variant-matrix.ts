import type { ProductVariant } from "@/features/catalog/products/types";

export interface VariantAxis {
  /** Stable key: option_type_id when present, else option_type title. */
  key: string;
  title: string;
  values: string[];
}

function axisKey(optionTypeId: number, optionType: string): string {
  if (Number.isFinite(optionTypeId) && optionTypeId > 0) {
    return `id:${optionTypeId}`;
  }
  return `name:${optionType.trim() || "option"}`;
}

function axisTitle(optionType: string, optionTypeTitle: string): string {
  return optionType.trim() || optionTypeTitle.trim() || "گزینه";
}

/**
 * Build unique option axes from active variants. Returns empty when variants
 * don't share multi-option structure (caller should fall back to chip list).
 */
export function buildVariantAxes(variants: ProductVariant[]): VariantAxis[] {
  const order: string[] = [];
  const titles = new Map<string, string>();
  const values = new Map<string, Set<string>>();

  for (const variant of variants) {
    for (const option of variant.options ?? []) {
      const key = axisKey(option.option_type_id, option.option_type);
      const value = option.value.trim();
      if (!value) continue;
      if (!values.has(key)) {
        order.push(key);
        titles.set(key, axisTitle(option.option_type, option.option_type_title));
        values.set(key, new Set());
      }
      values.get(key)!.add(value);
    }
  }

  // Multi-axis (or single axis with multiple values) is useful only when there
  // is something to choose. One axis with one value is still a plain single SKU.
  const axes = order.map((key) => ({
    key,
    title: titles.get(key) ?? "گزینه",
    values: Array.from(values.get(key) ?? []),
  }));

  const choosable = axes.filter((axis) => axis.values.length > 1);
  if (choosable.length === 0) return [];
  // Prefer full axes list when at least one is multi-value (include single-value
  // axes for completeness when multiple types exist).
  return axes.length > 1 ? axes : choosable;
}

export function variantMatchesSelection(
  variant: ProductVariant,
  selection: Record<string, string>,
): boolean {
  const options = variant.options ?? [];
  for (const [key, value] of Object.entries(selection)) {
    if (!value) continue;
    const hit = options.some((option) => {
      const optionKey = axisKey(option.option_type_id, option.option_type);
      return optionKey === key && option.value.trim() === value;
    });
    if (!hit) return false;
  }
  return true;
}

export function findVariantForSelection(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | undefined {
  return variants.find((variant) =>
    variantMatchesSelection(variant, selection),
  );
}

/** Whether picking `value` on `axisKey` still has a matching variant. */
export function isOptionValueAvailable(
  variants: ProductVariant[],
  selection: Record<string, string>,
  axis: string,
  value: string,
  requireStock = false,
): boolean {
  const next = { ...selection, [axis]: value };
  return variants.some((variant) => {
    if (!variantMatchesSelection(variant, next)) return false;
    if (!requireStock) return true;
    return Math.max(0, variant.available_stock ?? 0) > 0;
  });
}

/** Seed selection from a default variant's options. */
export function selectionFromVariant(
  variant: ProductVariant | undefined,
  axes: VariantAxis[],
): Record<string, string> {
  const selection: Record<string, string> = {};
  if (!variant) return selection;
  for (const axis of axes) {
    const option = (variant.options ?? []).find(
      (item) => axisKey(item.option_type_id, item.option_type) === axis.key,
    );
    if (option?.value.trim()) {
      selection[axis.key] = option.value.trim();
    } else if (axis.values[0]) {
      selection[axis.key] = axis.values[0];
    }
  }
  return selection;
}
