import { z } from "zod";

export const heroSlideFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "عنوان اسلاید الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  eyebrow: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
  subtitle: z.string(),
  badge: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
  image_url: z
    .string()
    .trim()
    .min(1, "نشانی تصویر الزامی است")
    .max(2048, "نشانی تصویر بسیار طولانی است"),
  mobile_image_url: z
    .string()
    .trim()
    .max(2048, "نشانی تصویر بسیار طولانی است"),
  image_alt: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  cta_label: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
  cta_href: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  secondary_cta_label: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
  secondary_cta_href: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  theme: z.enum(["light", "dark"]),
  sort_order: z.string().refine(
    (value) =>
      value.trim() === "" ||
      (!Number.isNaN(Number(value)) && Number.isInteger(Number(value))),
    { message: "عدد صحیح وارد کنید" },
  ),
  is_active: z.boolean(),
});

export type HeroSlideFormValues = z.infer<typeof heroSlideFormSchema>;
