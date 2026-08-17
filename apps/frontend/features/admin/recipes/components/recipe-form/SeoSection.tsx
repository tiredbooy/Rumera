"use client";

import { Sparkles } from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { useState, type Ref } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldErrorId } from "@/components/ui/field";
import { ImageInput } from "@/features/image-uploader/ImageInput";
import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import {
  SearchSnippetPreview,
  SeoCharCount,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
} from "@/features/admin/shared/seo-fields";
import { previewPath } from "@/features/admin/shared/seo-preview";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { Field } from "./FormLayout";

export function SeoSection({
  register,
  control,
  errors,
  ownerId,
  mediaRef,
  disabled,
}: {
  register: UseFormRegister<RecipeFormValues>;
  control: Control<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  ownerId?: number | null;
  mediaRef: Ref<ImageUploaderHandle<UploadedImage | null>>;
  disabled?: boolean;
}) {
  const [openSection, setOpenSection] = useState("");
  const hasSEOError = Boolean(
    errors.meta_title ||
      errors.meta_description ||
      errors.og_image_url ||
      errors.canonical_url ||
      errors.meta_keywords,
  );
  const title = useWatch({ control, name: "title" }) ?? "";
  const excerpt = useWatch({ control, name: "excerpt" }) ?? "";
  const slug = useWatch({ control, name: "slug" }) ?? "";
  const metaTitle = useWatch({ control, name: "meta_title" }) ?? "";
  const metaDescription = useWatch({ control, name: "meta_description" }) ?? "";
  const canonical = useWatch({ control, name: "canonical_url" }) ?? "";

  return (
    <Accordion
      type="single"
      collapsible
      value={hasSEOError ? "seo" : openSection}
      onValueChange={setOpenSection}
      className="bg-card ring-1 ring-foreground/[0.04]"
    >
      <AccordionItem value="seo">
        <AccordionTrigger>
          <span className="eyebrow">
            <Sparkles className="size-3.5" aria-hidden />
            سئو و متادیتا
          </span>
        </AccordionTrigger>
        <AccordionContent
          forceMount
          onFocusCapture={() => setOpenSection("seo")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="meta_title"
              label="عنوان سئو"
              error={errors.meta_title?.message}
              hint={`خالی = عنوان دستور. گوگل حدود ${SEO_TITLE_LIMIT} نویسه نشان می‌دهد.`}
              full
            >
              <div className="space-y-1.5">
                <Input id="meta_title" {...register("meta_title")} />
                <SeoCharCount value={metaTitle} limit={SEO_TITLE_LIMIT} />
              </div>
            </Field>
            <Field
              id="meta_description"
              label="توضیحات سئو"
              error={errors.meta_description?.message}
              hint={`خالی = خلاصه، سپس توضیح دستور. گوگل حدود ${SEO_DESCRIPTION_LIMIT} نویسه نشان می‌دهد.`}
              full
            >
              <div className="space-y-1.5">
                <Textarea
                  id="meta_description"
                  rows={2}
                  {...register("meta_description")}
                />
                <SeoCharCount
                  value={metaDescription}
                  limit={SEO_DESCRIPTION_LIMIT}
                />
              </div>
            </Field>
            <Field
              id="canonical_url"
              label="نشانی کانونیکال"
              error={errors.canonical_url?.message}
              hint="خالی = مسیر همین دستور روی فروشگاه."
              full
            >
              <Input
                id="canonical_url"
                dir="ltr"
                placeholder="/recipes/mojito"
                {...register("canonical_url")}
              />
            </Field>
            <Field
              id="meta_keywords"
              label="کلیدواژه‌ها"
              error={errors.meta_keywords?.message}
              hint="با کاما جدا کنید. روی صفحهٔ دستور به برچسب‌ها اضافه می‌شود."
              full
            >
              <Input
                id="meta_keywords"
                placeholder="نعنا، یخ، رم"
                {...register("meta_keywords")}
              />
            </Field>
            <div className="sm:col-span-2">
              <SearchSnippetPreview
                metaTitle={metaTitle}
                fallbackTitle={title}
                metaDescription={metaDescription}
                descriptionFallbacks={[excerpt]}
                path={previewPath(
                  canonical,
                  `/recipes/${encodeURIComponent(slug.trim() || "…")}`,
                )}
              />
            </div>
            <Field
              id="og_image_url"
              label="تصویر اشتراک‌گذاری"
              error={errors.og_image_url?.message}
              hint="خالی = تصویر شاخص دستور."
              full
            >
              <Controller
                control={control}
                name="og_image_url"
                render={({ field }) => (
                  <ImageInput
                    ref={mediaRef}
                    id="og_image_url"
                    name={field.name}
                    urlInputRef={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    owner={{ ownerType: "recipes", ownerId, role: "og" }}
                    placeholder="https://… یا بارگذاری فایل"
                    ariaInvalid={!!errors.og_image_url}
                    ariaDescribedBy={
                      errors.og_image_url
                        ? fieldErrorId("og_image_url")
                        : undefined
                    }
                    disabled={disabled}
                  />
                )}
              />
            </Field>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
