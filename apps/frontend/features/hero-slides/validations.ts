import { z } from "zod";
import { validateImageURL } from "@/features/image-uploader/constants";

const imageURL = z
  .string()
  .trim()
  .max(2048, "نشانی تصویر بسیار طولانی است")
  .superRefine((value, context) => {
    const error = validateImageURL(value, {
      allowEmpty: true,
      allowMediaPath: true,
    });
    if (error) context.addIssue({ code: "custom", message: error });
  });

export const heroSlideFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "عنوان اسلاید الزامی است")
      .max(255, "حداکثر ۲۵۵ نویسه"),
    eyebrow: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    subtitle: z.string(),
    badge: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    image_url: imageURL,
    mobile_image_url: imageURL,
    image_alt: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
    cta_label: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    cta_href: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
    secondary_cta_label: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    secondary_cta_href: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
    theme: z.enum(["light", "dark"]),
    sort_order: z
      .string()
      .refine(
        (value) =>
          value.trim() === "" ||
          (!Number.isNaN(Number(value)) && Number.isInteger(Number(value))),
        { message: "عدد صحیح وارد کنید" },
      ),
    is_active: z.boolean(),
    desktop_file_staged: z.boolean(),
  })
  .superRefine((value, context) => {
    if (
      value.is_active &&
      value.image_url.trim() === "" &&
      !value.desktop_file_staged
    ) {
      context.addIssue({
        code: "custom",
        path: ["image_url"],
        message: "برای فعال‌سازی، نشانی یا فایل تصویر دسکتاپ الزامی است",
      });
    }
  });

export type HeroSlideFormValues = z.infer<typeof heroSlideFormSchema>;
