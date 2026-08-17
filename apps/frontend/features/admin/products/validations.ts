import { z } from "zod";
import type { ProductDetail } from "@/features/catalog/products/types";
import { parseAsciiNumber, toAsciiDigits } from "@/lib/normalize-digits";

const numberish = (msg: string) =>
  z
    .string()
    .refine(
      (v) => {
        const n = toAsciiDigits(v).trim();
        return n === "" || (Number.isFinite(Number(n)) && Number(n) >= 0);
      },
      {
        message: msg,
      },
    );

function isPositivePrice(value: string) {
  const n = toAsciiDigits(value).trim();
  return n !== "" && Number.isFinite(Number(n)) && Number(n) > 0;
}

export const variantSchema = z.object({
  _id: z.number().optional(),
  sku: z.string().max(250),
  price: z.string(),
  compare_at_price: numberish("قیمت نامعتبر است"),
  is_active: z.boolean(),
  option_value_ids: z
    .array(z.number().int().positive())
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "هر مقدار ویژگی فقط یک‌بار قابل انتخاب است",
    }),
});

export const productFormSchema = z
  .object({
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
      (v) => {
        const n = toAsciiDigits(v).trim();
        return n === "" || Number(n) <= 100;
      },
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
  })
  .superRefine((value, ctx) => {
    if (value.is_active && value.slug.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "برای انتشار، نامک الزامی است",
      });
    }

    const skuRows = new Map<string, number[]>();
    const combinationRows = new Map<string, number[]>();

    value.variants.forEach((variant, index) => {
      const rawPrice = toAsciiDigits(variant.price).trim();
      if (rawPrice === "") {
        if (value.is_active) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", index, "price"],
            message: "قیمت معتبر وارد کنید",
          });
        }
      } else if (!isPositivePrice(variant.price)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "price"],
          message: "قیمت معتبر وارد کنید",
        });
      }

      const price = parseAsciiNumber(variant.price);
      const compareAtPrice = parseAsciiNumber(variant.compare_at_price);
      if (
        variant.compare_at_price.trim() !== "" &&
        Number.isFinite(price) &&
        Number.isFinite(compareAtPrice) &&
        compareAtPrice <= price
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "compare_at_price"],
          message: "قیمت پیش از تخفیف باید بیشتر از قیمت فروش باشد",
        });
      }

      const sku = variant.sku.trim().toLocaleLowerCase("en-US");
      if (sku) skuRows.set(sku, [...(skuRows.get(sku) ?? []), index]);

      const optionIds = [...new Set(variant.option_value_ids)].sort(
        (left, right) => left - right,
      );
      if (optionIds.length > 0) {
        const key = optionIds.join(":");
        combinationRows.set(key, [...(combinationRows.get(key) ?? []), index]);
      }
    });

    for (const rows of skuRows.values()) {
      if (rows.length < 2) continue;
      for (const index of rows) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "sku"],
          message: "SKU هر تنوع باید یکتا باشد",
        });
      }
    }
    for (const rows of combinationRows.values()) {
      if (rows.length < 2) continue;
      for (const index of rows) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "option_value_ids"],
          message: "این ترکیب ویژگی برای تنوع دیگری انتخاب شده است",
        });
      }
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type VariantFormValues = z.infer<typeof variantSchema>;

export const strOrNull = (v?: string) =>
  v && v.trim() !== "" ? v.trim() : null;
export const numOrNull = (v?: string) => {
  if (!v) return null;
  const n = toAsciiDigits(v).trim();
  return n !== "" ? Number(n) : null;
};

export const parseTags = (v: string) =>
  v
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean);

/** Create-form seed: keep catalogue facts, drop identity, SKUs, and media. */
export function toDuplicateSeed(product: ProductDetail): ProductDetail {
  return {
    ...product,
    id: 0,
    title: "",
    slug: "",
    code: undefined,
    images: [],
    variants: (product.variants ?? []).map((variant) => ({
      ...variant,
      id: 0,
      sku: "",
      images: [],
    })),
  };
}

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
    is_active: product?.is_active ?? false,
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
      is_active: v.is_active,
      option_value_ids: (v.options ?? []).map((option) => option.id),
    })),
  };
}
