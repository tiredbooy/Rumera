"use client";

import { Sparkles } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { Field, Section } from "./FormLayout";

export function GeneralInfoSection({
  register,
  errors,
}: {
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
}) {
  return (
    <Section
      icon={Sparkles}
      title="اطلاعات کلی"
      description="عنوان و معرفی کوتاه دستور."
    >
      <Field id="title" label="عنوان دستور" error={errors.title?.message} full>
        <Input
          id="title"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          {...register("title")}
        />
      </Field>
      <Field
        id="slug"
        label="نامک (انگلیسی)"
        error={errors.slug?.message}
        hint="خالی بگذارید تا از روی عنوان ساخته شود."
      >
        <Input
          id="slug"
          dir="ltr"
          placeholder="negroni-classico"
          {...register("slug")}
        />
      </Field>
      <Field id="excerpt" label="خلاصه" error={errors.excerpt?.message}>
        <Input
          id="excerpt"
          placeholder="یک کوکتل تلخ و کلاسیک ایتالیایی"
          {...register("excerpt")}
        />
      </Field>
    </Section>
  );
}
