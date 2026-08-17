import { z } from "zod";

import { toAsciiDigits } from "@/lib/normalize-digits";

import { faNum } from "../../../lib/products";

export const BRAND_CURRENT_YEAR = new Date().getFullYear();

export const brandFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "نام برند الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z
    .string()
    .trim()
    .max(255, "حداکثر ۲۵۵ نویسه")
    .refine(
      (value) =>
        value === "" ||
        /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value.toLowerCase()),
      { message: "شناسهٔ نشانی باید از حروف، عدد و خط تیره ساخته شود" },
    ),
  country: z.string().trim().max(80, "حداکثر ۸۰ نویسه"),
  founded_year: z.string().refine(
    (value) => {
      const n = toAsciiDigits(value).trim();
      return (
        n === "" ||
        (/^\d+$/.test(n) &&
          Number(n) >= 1000 &&
          Number(n) <= BRAND_CURRENT_YEAR)
      );
    },
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
