import { z } from "zod";

import { toAsciiDigits } from "@/lib/normalize-digits";

export const profileFormSchema = z.object({
  first_name: z.string().trim().min(2, "نام را وارد کنید"),
  last_name: z.string().trim().min(2, "نام خانوادگی را وارد کنید"),
  phone: z
    .string()
    .refine(
      (value) =>
        value === "" || /^09\d{9}$/.test(toAsciiDigits(value).trim()),
      { message: "شمارهٔ موبایل معتبر نیست" },
    )
    .transform((value) =>
      value === "" ? "" : toAsciiDigits(value).trim(),
    ),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
