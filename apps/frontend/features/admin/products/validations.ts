import { z } from "zod";
import type { ProductDetail } from "@/features/catalog/products/types";

const numberish = (msg: string) =>
  z
    .string()
    .refine(
      (v) => v.trim() === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      {
        message: msg,
      },
    );

export const variantSchema = z.object({
  _id: z.number().optional(),
  sku: z.string().max(250),
  price: z
    .string()
    .refine(
      (v) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) > 0,
      {
        message: "قیمت معتبر وارد کنید",
      },
    ),
  compare_at_price: numberish("قیمت نامعتبر است"),
  option_value_ids: z.array(z.number()),
});

export const productFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "نام محصول الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z.string().trim().max(255),
  code: z.string().trim().max(80),
  description: z.string(),
  category_id: z.string(),
  brand_id: z.string(),
  country_of_origin: z.string().trim().max(100),
  abv: numberish("بین ۰ تا ۱۰۰").refine(
    (v) => v.trim() === "" || Number(v) <= 100,
    {
      message: "حداکثر ۱۰۰",
    },
  ),
  weight: numberish("وزن نامعتبر است"),
  is_active: z.boolean(),
  meta_title: z.string().trim().max(225),
  meta_description: z.string(),
  meta_tags: z.string(),
  tag_ids: z.array(z.number()),
  variants: z.array(variantSchema),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type VariantFormValues = z.infer<typeof variantSchema>;

export const strOrNull = (v?: string) =>
  v && v.trim() !== "" ? v.trim() : null;
export const numOrNull = (v?: string) =>
  v && v.trim() !== "" ? Number(v) : null;

export const parseTags = (v: string) =>
  v
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean);

export function getDefaultFormValues(
  product?: ProductDetail,
): ProductFormValues {
  return {
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    code: product?.code ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ? String(product.category_id) : "",
    brand_id: product?.brand_id ? String(product.brand_id) : "",
    country_of_origin: product?.country_of_origin ?? "",
    abv: product?.abv != null ? String(product.abv) : "",
    weight: product?.weight != null ? String(product.weight) : "",
    is_active: product?.is_active ?? true,
    meta_title: product?.meta_title ?? "",
    meta_description: product?.meta_description ?? "",
    meta_tags: (product?.meta_tags ?? []).join("، "),
    tag_ids: (product?.tags ?? []).map((t) => t.id),
    variants: (product?.variants ?? []).map((v) => ({
      _id: v.id,
      sku: v.sku ?? "",
      price: String(v.price),
      compare_at_price:
        v.compare_at_price != null ? String(v.compare_at_price) : "",
      option_value_ids: (v.options ?? []).map((option) => option.id),
    })),
  };
}
