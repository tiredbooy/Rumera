import { toAsciiDigits } from "@/lib/normalize-digits";
import type { ProductOptionGroup } from "./types";

/**
 * SKU auto-generation for the variant table (PE-1).
 *
 * The rule is `<product code>-<option slug>-<option slug>…`, with the option
 * segments emitted in option-type order so the same combination always produces
 * the same SKU no matter which order the operator picked the values in.
 */

/**
 * One option value as an SKU segment: Eastern digits folded to ASCII, accents
 * dropped, everything else collapsed to a dash.
 *
 * A Persian value («قرمز») has no ASCII left after folding, so the value id
 * stands in. It is stable, unique and short — which is the whole job of an SKU
 * segment — and it beats emitting an empty segment that would make two
 * different combinations share one SKU.
 */
export function optionValueSlug(value: { id: number; value: string }): string {
  const slug = toAsciiDigits(value.value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `V${value.id}`;
}

/** `BLK-750ML-V11` — the SKU a combination would get before de-duplication. */
export function buildVariantSku(
  code: string,
  optionValueIds: number[],
  optionTypes: ProductOptionGroup[],
): string {
  const selected = new Set(optionValueIds);
  const segments = optionTypes.flatMap((group) =>
    group.values.filter((value) => selected.has(value.id)).map(optionValueSlug),
  );
  return [code, ...segments].join("-");
}

/** The product code an SKU can be built from, or null when it is not set yet. */
export function skuPrefix(code: string): string | null {
  const prefix = toAsciiDigits(code)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return prefix || null;
}

/**
 * Fills the blank SKUs of `targets` (all rows when omitted).
 *
 * Never returns an entry for a row whose SKU the operator already typed — an
 * SKU is a catalogue identifier that may already be printed on a label, so
 * regenerating one is destructive. Candidates are de-duplicated against every
 * SKU in the product, typed or generated, because `productFormSchema` rejects
 * the whole form when two rows collide.
 */
export function generateVariantSkus(
  code: string,
  optionTypes: ProductOptionGroup[],
  variants: readonly { sku: string; option_value_ids: number[] }[],
  targets?: readonly number[],
): Map<number, string> {
  const generated = new Map<number, string>();
  const prefix = skuPrefix(code);
  if (!prefix) return generated;

  const taken = new Set(
    variants
      .map((variant) => variant.sku.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
  const indexes = targets ?? variants.map((_, index) => index);

  for (const index of indexes) {
    const variant = variants[index];
    if (!variant || variant.sku.trim() !== "") continue;
    const base = buildVariantSku(
      prefix,
      variant.option_value_ids ?? [],
      optionTypes,
    );
    let candidate = base;
    for (
      let suffix = 2;
      taken.has(candidate.toLocaleLowerCase("en-US"));
      suffix += 1
    ) {
      candidate = `${base}-${suffix}`;
    }
    taken.add(candidate.toLocaleLowerCase("en-US"));
    generated.set(index, candidate);
  }
  return generated;
}
