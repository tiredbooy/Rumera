import { z } from "zod";

export const addressFormSchema = z.object({
  title: z.string().trim().optional(),
  full_name: z.string().trim().min(2, "نام گیرنده را وارد کنید"),
  phone_number: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شمارهٔ موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)"),
  state_province: z.string().min(1, "استان را انتخاب کنید"),
  city: z.string().trim().min(2, "شهر را وارد کنید"),
  postal_code: z.string().trim().regex(/^\d{10}$/, "کد پستی باید ۱۰ رقم باشد"),
  address_line1: z.string().trim().min(5, "نشانی را کامل وارد کنید"),
  address_line2: z.string().trim().optional(),
  is_default: z.boolean().optional(),
});

export type AddressFormValues = z.infer<typeof addressFormSchema>;
