import { z } from "zod";
import { validateImageURL } from "@/features/image-uploader/constants";

const categorySlugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export const categoryFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "نام دسته‌بندی الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z
    .string()
    .trim()
    .max(255, "حداکثر ۲۵۵ نویسه")
    .refine(
      (value) => value === "" || categorySlugPattern.test(value),
      "نامک فقط می‌تواند شامل حرف، عدد و خط تیره باشد",
    ),
  parent_id: z.string(),
  description: z.string(),
  image_url: z
    .string()
    .trim()
    .superRefine((value, context) => {
      const error = validateImageURL(value, {
        allowEmpty: true,
        allowMediaPath: true,
      });
      if (error) context.addIssue({ code: "custom", message: error });
    }),
  is_featured: z.boolean(),
  card_size: z.enum(["small", "large"]),
  display_order: z.string().trim(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
