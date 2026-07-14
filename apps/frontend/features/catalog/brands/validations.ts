import { z } from "zod";

import { faNum } from "../../../lib/products";

export const BRAND_CURRENT_YEAR = new Date().getFullYear();

export const brandFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "نام برند الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  country: z.string().trim().max(80, "حداکثر ۸۰ نویسه"),
  founded_year: z.string().refine(
    (value) =>
      value.trim() === "" ||
      (/^\d+$/.test(value.trim()) &&
        Number(value) >= 1000 &&
        Number(value) <= BRAND_CURRENT_YEAR),
    { message: `سالی بین ۱۰۰۰ تا ${faNum(BRAND_CURRENT_YEAR)} وارد کنید` },
  ),
  image_url: z
    .string()
    .trim()
    .refine((value) => value === "" || /^https?:\/\/.+/i.test(value), {
      message: "نشانی تصویر باید یک URL معتبر باشد (با http یا https)",
    }),
  description: z.string(),
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;
