import { z } from "zod";

import type { ProductOptionType } from "@/features/admin/products/types";

/** Stable admin code: latin slug-like, no spaces. */
export function normalizeOptionTitle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const optionTypeFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "کد ویژگی الزامی است.")
    .max(80, "حداکثر ۸۰ نویسه.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "فقط حروف انگلیسی کوچک، عدد و خط تیره."),
  display_name: z
    .string()
    .trim()
    .min(1, "نام نمایشی الزامی است.")
    .max(100, "حداکثر ۱۰۰ نویسه."),
});

export type OptionTypeFormValues = z.infer<typeof optionTypeFormSchema>;

export function optionTypeFormDefaults(
  type?: ProductOptionType,
): OptionTypeFormValues {
  return {
    title: type?.title ?? "",
    display_name: type?.display_name ?? "",
  };
}

export const optionValueFormSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1, "مقدار الزامی است.")
    .max(100, "حداکثر ۱۰۰ نویسه."),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type OptionValueFormValues = z.infer<typeof optionValueFormSchema>;
