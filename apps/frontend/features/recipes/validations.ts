import { z } from "zod";
import { validateImageURL } from "@/features/image-uploader/constants";
import { parseAsciiNumber, toAsciiDigits } from "@/lib/normalize-digits";

const intish = (message: string, options: { min?: number } = {}) =>
  z.string().refine(
    (value) => {
      if (toAsciiDigits(value).trim() === "") return true;
      const number = parseAsciiNumber(value);
      return (
        Number.isInteger(number) &&
        (options.min === undefined || number >= options.min)
      );
    },
    { message },
  );

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

export const recipeIngredientFormSchema = z.object({
  ingredient_name: z
    .string()
    .trim()
    .min(1, "نام ماده الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  quantity: z.string().trim().max(50),
  unit: z.string().trim().max(50),
  notes: z.string().trim().max(255),
  optional: z.boolean(),
  product_variant_id: z.number().nullable(),
  _label: z.string().optional(),
  _brand: z.string().nullable().optional(),
  _sku: z.string().nullable().optional(),
});

export const recipeProductFormSchema = z.object({
  product_variant_id: z
    .number({ message: "یک فرآورده انتخاب کنید" })
    .int()
    .min(1, "یک فرآورده انتخاب کنید"),
  _label: z.string().optional(),
  _brand: z.string().nullable().optional(),
  _sku: z.string().nullable().optional(),
  quantity: z.string().trim().max(50),
  unit: z.string().trim().max(50),
  is_primary: z.boolean(),
});

export const recipeFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "عنوان دستور الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z.string().trim().max(255),
  excerpt: z.string().trim().max(500),
  content: z
    .string()
    .refine((value) => value.trim() !== "" && value !== "<p></p>", {
      message: "محتوای دستور الزامی است",
    }),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prep_time_minutes: intish("عدد صحیح وارد کنید", { min: 0 }),
  cook_time_minutes: intish("عدد صحیح وارد کنید", { min: 0 }),
  servings: intish("حداقل ۱", { min: 1 }),
  status: z.enum(["draft", "published", "archived"]),
  published_at: z.string(),
  image_url: imageURL,
  image_alt: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  og_image_url: imageURL,
  is_featured: z.boolean(),
  meta_title: z.string().trim().max(255),
  meta_description: z.string().trim().max(500),
  canonical_url: z
    .string()
    .trim()
    .max(2048, "نشانی کانونیکال بسیار طولانی است")
    .refine(
      (value) =>
        value === "" ||
        /^https?:\/\//i.test(value) ||
        value.startsWith("/"),
      "نشانی کانونیکال باید مسیر یا نشانی کامل باشد",
    ),
  meta_keywords: z.string().trim().max(500),
  tag_ids: z.array(z.number()),
  ingredients: z.array(recipeIngredientFormSchema),
  products: z.array(recipeProductFormSchema),
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;
