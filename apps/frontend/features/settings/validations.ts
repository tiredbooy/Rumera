import { z } from "zod";

const emailish = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "ایمیل معتبر وارد کنید",
  });

export const siteSettingsFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "نام فروشگاه الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  tagline: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  logoUrl: z.string().trim().max(2048, "حداکثر ۲۰۴۸ نویسه"),
  description: z.string().max(2000, "حداکثر ۲۰۰۰ نویسه"),
  supportEmail: emailish,
  supportPhone: z.string().trim().max(40, "حداکثر ۴۰ نویسه"),
  address: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  workingHours: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  instagram: z.string().trim().max(255),
  telegram: z.string().trim().max(255),
  whatsapp: z.string().trim().max(255),
  twitter: z.string().trim().max(255),
  youtube: z.string().trim().max(255),
  linkedin: z.string().trim().max(255),
  freeThreshold: z.string().refine(
    (value) =>
      value.trim() === "" ||
      (/^\d+$/.test(value.trim()) &&
        Number.isInteger(Number(value)) &&
        Number(value) >= 0),
    { message: "عدد صحیح و نامنفی وارد کنید" },
  ),
  note: z.string().max(1000, "حداکثر ۱۰۰۰ نویسه"),
  defaultTitle: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  defaultDescription: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  ogImage: z.string().trim().max(2048, "حداکثر ۲۰۴۸ نویسه"),
  keywords: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  enabled: z.boolean(),
  message: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
});

export type SiteSettingsFormValues = z.infer<typeof siteSettingsFormSchema>;
