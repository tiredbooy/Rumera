"use client";

import { Sparkles } from "lucide-react";
import { Controller } from "react-hook-form";
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
    errors.meta_title || errors.meta_description || errors.og_image_url,
  );

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
              full
            >
              <Input id="meta_title" {...register("meta_title")} />
            </Field>
            <Field
              id="meta_description"
              label="توضیحات سئو"
              error={errors.meta_description?.message}
              full
            >
              <Textarea
                id="meta_description"
                rows={2}
                {...register("meta_description")}
              />
            </Field>
            <Field
              id="og_image_url"
              label="تصویر اشتراک‌گذاری"
              error={errors.og_image_url?.message}
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
