import { z } from "zod";

export const customerEditFormSchema = z.object({
  first_name: z.string().trim().max(100, "حداکثر ۱۰۰ نویسه"),
  last_name: z.string().trim().max(100, "حداکثر ۱۰۰ نویسه"),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9۰-۹+\-\s]{7,20}$/.test(value), {
      message: "شمارهٔ تلفن معتبر وارد کنید",
    }),
  national_code: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9۰-۹]{10}$/.test(value), {
      message: "کد ملی باید ۱۰ رقم باشد",
    }),
  birth_date: z.string(),
  gender: z.union([z.literal(""), z.enum(["male", "female", "other"])]),
  role: z.enum(["customer", "vendor", "admin"]),
  is_active: z.boolean(),
});

export type CustomerEditFormValues = z.infer<typeof customerEditFormSchema>;
