"use client";

import { Sparkles } from "lucide-react";
import { Controller } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { Ref } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FlexibleImageInput } from "@/features/admin/uploads/components/flexible-image-input";
import type { FlexibleImageInputHandle } from "@/features/admin/uploads/types";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { Field } from "./FormLayout";

export function SeoSection({
  register,
  control,
  errors,
  ownerId,
  mediaRef,
}: {
  register: UseFormRegister<RecipeFormValues>;
  control: Control<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  ownerId?: number | null;
  mediaRef: Ref<FlexibleImageInputHandle>;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="bg-card ring-1 ring-foreground/[0.04]"
    >
      <AccordionItem value="seo">
        <AccordionTrigger>
          <span className="eyebrow">
            <Sparkles className="size-3.5" aria-hidden />
            سئو و متادیتا
          </span>
        </AccordionTrigger>
        <AccordionContent>
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
                  <FlexibleImageInput
                    ref={mediaRef}
                    id="og_image_url"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    owner={{ ownerType: "recipes", ownerId, role: "og" }}
                    placeholder="https://… یا بارگذاری فایل"
                    ariaInvalid={!!errors.og_image_url}
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
