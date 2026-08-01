import { z } from "zod";

import { validateImageURL } from "@/features/image-uploader/constants";
import type {
  CreateJournalCategoryInput,
  CreateJournalPostInput,
  JournalCategory,
  JournalDetail,
  UpdateJournalCategoryInput,
  UpdateJournalPostInput,
} from "./types";

const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function normalizeJournalSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function containsRichText(value: string): boolean {
  return (
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim().length > 0
  );
}

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

const relationIDs = z.array(z.number().int().positive());

export const journalPostFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "عنوان نوشته الزامی است")
      .max(255, "حداکثر ۲۵۵ نویسه"),
    slug: z
      .string()
      .trim()
      .max(255, "حداکثر ۲۵۵ نویسه")
      .refine(
        (value) => value === "" || slugPattern.test(value),
        "نامک فقط می‌تواند شامل حرف، عدد و خط تیره باشد",
      ),
    excerpt: z.string().trim().max(500, "حداکثر ۵۰۰ نویسه"),
    content: z.string().refine(containsRichText, "محتوای نوشته الزامی است"),
    image_url: imageURL,
    image_alt: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
    time_to_read: z.string().refine((value) => {
      const number = Number(value);
      return Number.isInteger(number) && number >= 1;
    }, "زمان مطالعه باید یک عدد صحیح و حداقل ۱ دقیقه باشد"),
    status: z.enum(["draft", "published", "archived"]),
    is_featured: z.boolean(),
    meta_title: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
    meta_description: z.string().trim().max(500, "حداکثر ۵۰۰ نویسه"),
    category_ids: relationIDs,
    product_ids: relationIDs,
    tag_ids: relationIDs,
  })
  .superRefine((values, context) => {
    if (values.slug && !normalizeJournalSlug(values.slug)) {
      context.addIssue({
        code: "custom",
        path: ["slug"],
        message: "برای نامک دست‌کم یک حرف یا عدد وارد کنید",
      });
    }
    if (values.image_url && !values.image_alt) {
      context.addIssue({
        code: "custom",
        path: ["image_alt"],
        message: "برای تصویر شاخص متن جایگزین بنویسید",
      });
    }
  });

export type JournalPostFormValues = z.infer<typeof journalPostFormSchema>;

export function journalPostFormDefaults(
  post?: JournalDetail,
): JournalPostFormValues {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    image_url: post?.image_url ?? "",
    image_alt: post?.image_alt ?? "",
    time_to_read: String(post?.time_to_read ?? 1),
    status: post?.status ?? "draft",
    is_featured: post?.is_featured ?? false,
    meta_title: post?.meta_title ?? "",
    meta_description: post?.meta_description ?? "",
    category_ids: post?.categories.map((category) => category.id) ?? [],
    product_ids: post?.product_ids ?? [],
    tag_ids: post?.tag_ids ?? [],
  };
}

function nullableText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function journalPostPayload(
  values: JournalPostFormValues,
): CreateJournalPostInput {
  const slug = normalizeJournalSlug(values.slug);
  return {
    title: values.title.trim(),
    ...(slug ? { slug } : {}),
    content: values.content,
    excerpt: nullableText(values.excerpt),
    image_url: nullableText(values.image_url),
    image_alt: nullableText(values.image_alt),
    time_to_read: Number(values.time_to_read),
    status: values.status,
    is_featured: values.is_featured,
    meta_title: nullableText(values.meta_title),
    meta_description: nullableText(values.meta_description),
    category_ids: Array.from(new Set(values.category_ids)),
    product_ids: Array.from(new Set(values.product_ids)),
    tag_ids: Array.from(new Set(values.tag_ids)),
  };
}

export function toCreateJournalPostInput(
  values: JournalPostFormValues,
): CreateJournalPostInput {
  return journalPostPayload(values);
}

export function toUpdateJournalPostInput(
  values: JournalPostFormValues,
): CreateJournalPostInput & UpdateJournalPostInput {
  return journalPostPayload(values);
}

export const journalCategoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "نام دسته الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z
    .string()
    .trim()
    .max(255, "حداکثر ۲۵۵ نویسه")
    .refine(
      (value) => value === "" || slugPattern.test(value),
      "نامک فقط می‌تواند شامل حرف، عدد و خط تیره باشد",
    ),
  description: z.string(),
  parent_id: z
    .string()
    .refine(
      (value) => value === "" || /^[1-9]\d*$/.test(value),
      "دستهٔ مادر معتبر نیست",
    ),
});

export type JournalCategoryFormValues = z.infer<
  typeof journalCategoryFormSchema
>;

export function journalCategoryFormDefaults(
  category?: JournalCategory,
): JournalCategoryFormValues {
  return {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    parent_id: category?.parent_id ? String(category.parent_id) : "",
  };
}

export function journalCategoryParentOptions(
  categories: JournalCategory[],
  categoryID?: number,
): JournalCategory[] {
  if (!categoryID) return categories;
  const blocked = new Set([categoryID]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (
        category.parent_id !== null &&
        blocked.has(category.parent_id) &&
        !blocked.has(category.id)
      ) {
        blocked.add(category.id);
        changed = true;
      }
    }
  }
  return categories.filter((category) => !blocked.has(category.id));
}

function journalCategoryPayload(
  values: JournalCategoryFormValues,
): CreateJournalCategoryInput {
  const slug = normalizeJournalSlug(values.slug);
  return {
    name: values.name.trim(),
    description: nullableText(values.description),
    slug: slug || null,
    parent_id: values.parent_id ? Number(values.parent_id) : null,
  };
}

export function toCreateJournalCategoryInput(
  values: JournalCategoryFormValues,
): CreateJournalCategoryInput {
  return journalCategoryPayload(values);
}

export function toUpdateJournalCategoryInput(
  values: JournalCategoryFormValues,
): UpdateJournalCategoryInput {
  return journalCategoryPayload(values);
}
