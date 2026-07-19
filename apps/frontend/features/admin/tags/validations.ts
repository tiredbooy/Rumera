import { z } from "zod";

import type {
  CreateTagInput,
  Tag,
  UpdateTagInput,
} from "@/features/catalog/tags/types";

const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function normalizeTagSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export const tagFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "نام برچسب الزامی است")
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
  })
  .superRefine((values, context) => {
    if (normalizeTagSlug(values.slug || values.title)) return;
    context.addIssue({
      code: "custom",
      path: ["slug"],
      message: "برای نامک دست‌کم یک حرف یا عدد وارد کنید",
    });
  });

export type TagFormValues = z.infer<typeof tagFormSchema>;

export function tagFormDefaults(tag?: Tag): TagFormValues {
  return {
    title: tag?.title ?? "",
    slug: tag?.slug ?? "",
    description: tag?.description ?? "",
  };
}

function payload(values: TagFormValues): CreateTagInput {
  const slug = normalizeTagSlug(values.slug || values.title);
  const description = values.description.trim();
  return {
    title: values.title.trim(),
    slug,
    description: description || null,
  };
}

export function toCreateTagInput(values: TagFormValues): CreateTagInput {
  return payload(values);
}

export function toUpdateTagInput(values: TagFormValues): UpdateTagInput {
  return payload(values);
}
