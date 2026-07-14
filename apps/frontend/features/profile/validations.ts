import { z } from "zod";

export const profileFormSchema = z.object({
  first_name: z.string().trim().min(2, "نام را وارد کنید"),
  last_name: z.string().trim().min(2, "نام خانوادگی را وارد کنید"),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شمارهٔ موبایل معتبر نیست")
    .or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
