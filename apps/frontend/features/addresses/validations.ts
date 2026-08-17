import { z } from "zod";

import { toAsciiDigits } from "@/lib/normalize-digits";

export const addressFormSchema = z.object({
  title: z.string().trim().optional(),
  full_name: z.string().trim().min(2, "نام گیرنده را وارد کنید"),
  phone_number: z
    .string()
    .trim()
    .refine((value) => /^09\d{9}$/.test(toAsciiDigits(value)), {
      message: "شمارهٔ موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)",
    })
    .transform(toAsciiDigits),
  state_province: z.string().min(1, "استان را انتخاب کنید"),
  city: z.string().trim().min(2, "شهر را وارد کنید"),
  postal_code: z
    .string()
    .trim()
    .refine((value) => /^\d{10}$/.test(toAsciiDigits(value)), {
      message: "کد پستی باید ۱۰ رقم باشد",
    })
    .transform(toAsciiDigits),
  address_line1: z.string().trim().min(5, "نشانی را کامل وارد کنید"),
  address_line2: z.string().trim().optional(),
  is_default: z.boolean().optional(),
});

export type AddressFormValues = z.infer<typeof addressFormSchema>;
