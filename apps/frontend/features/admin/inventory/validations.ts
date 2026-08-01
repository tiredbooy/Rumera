import { z } from "zod";

import type { UpdateReorderThresholdInput } from "@/features/inventory/types";

export const MAX_INVENTORY_INTEGER = 2_147_483_647;
export const MIN_INVENTORY_INTEGER = -2_147_483_648;

export function toAsciiInventoryDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace("−", "-");
}

const nonnegativeInteger = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} الزامی است`)
    .refine(
      (value) => /^\d+$/.test(toAsciiInventoryDigits(value)),
      `${label} باید یک عدد صحیح و نامنفی باشد`,
    )
    .refine(
      (value) => Number(toAsciiInventoryDigits(value)) <= MAX_INVENTORY_INTEGER,
      `${label} از بیشینهٔ مجاز بیشتر است`,
    );

export const reorderThresholdSchema = z.object({
  reorder_point: nonnegativeInteger("آستانهٔ سفارش"),
  reorder_quantity: nonnegativeInteger("مقدار پیشنهادی سفارش"),
});

export type ReorderThresholdValues = z.infer<typeof reorderThresholdSchema>;

export function toReorderThresholdInput(
  values: ReorderThresholdValues,
): UpdateReorderThresholdInput {
  return {
    reorder_point: Number(toAsciiInventoryDigits(values.reorder_point)),
    reorder_quantity: Number(toAsciiInventoryDigits(values.reorder_quantity)),
  };
}

export const stockAdjustmentSchema = z
  .string()
  .trim()
  .min(1, "تغییر موجودی الزامی است")
  .refine(
    (value) => /^-?\d+$/.test(toAsciiInventoryDigits(value)),
    "تغییر موجودی باید یک عدد صحیح باشد",
  )
  .refine((value) => Number(toAsciiInventoryDigits(value)) !== 0, {
    message: "تغییر موجودی نمی‌تواند صفر باشد",
  })
  .refine((value) => {
    const parsed = Number(toAsciiInventoryDigits(value));
    return parsed >= MIN_INVENTORY_INTEGER && parsed <= MAX_INVENTORY_INTEGER;
  }, "تغییر موجودی خارج از بازهٔ مجاز است");

export function parseStockAdjustment(value: string): number | null {
  const parsed = stockAdjustmentSchema.safeParse(value);
  return parsed.success ? Number(toAsciiInventoryDigits(parsed.data)) : null;
}
