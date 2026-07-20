import { z } from "zod";

const intish = (message: string, options: { min?: number } = {}) =>
  z.string().refine(
    (value) => {
      if (value.trim() === "") return true;
      const number = Number(value);
      return (
        Number.isInteger(number) &&
        (options.min === undefined || number >= options.min)
      );
    },
    { message },
  );

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
  image_url: z.string().trim().max(500),
  og_image_url: z.string().trim().max(500),
  is_featured: z.boolean(),
  meta_title: z.string().trim().max(255),
  meta_description: z.string().trim().max(500),
  tag_ids: z.array(z.number()),
  ingredients: z.array(recipeIngredientFormSchema),
  products: z.array(recipeProductFormSchema),
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;
