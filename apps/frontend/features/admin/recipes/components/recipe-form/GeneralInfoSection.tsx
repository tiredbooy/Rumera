"use client";

import { Sparkles } from "lucide-react";
import { useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EXCERPT_LIMIT,
  editorialExcerptHint,
  editorialSlugHint,
} from "@/features/admin/shared/editorial-fields";
import { SeoCharCount } from "@/features/admin/shared/seo-fields";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { Field, Section } from "./FormLayout";

export function GeneralInfoSection({
  control,
  register,
  errors,
  mode,
  onSlugEdit,
}: {
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  mode: "create" | "edit";
  onSlugEdit: () => void;
}) {
  const excerpt = useWatch({ control, name: "excerpt" }) ?? "";

  return (
    <Section
      icon={Sparkles}
      title="اطلاعات کلی"
      description="عنوان و معرفی کوتاه دستور."
    >
      <Field id="title" label="عنوان" error={errors.title?.message} full>
        <Input
          id="title"
          autoComplete="off"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          {...register("title")}
        />
      </Field>
      <Field
        id="slug"
        label="نامک"
        error={errors.slug?.message}
        hint={editorialSlugHint(mode)}
        full
      >
        <Input
          id="slug"
          dir="auto"
          autoComplete="off"
          {...register("slug", { onChange: () => onSlugEdit() })}
        />
      </Field>
      <Field
        id="excerpt"
        label="خلاصه"
        error={errors.excerpt?.message}
        hint={editorialExcerptHint()}
        full
      >
        <div className="space-y-1.5">
          <Textarea id="excerpt" rows={4} {...register("excerpt")} />
          <SeoCharCount value={excerpt} limit={EXCERPT_LIMIT} />
        </div>
      </Field>
    </Section>
  );
}
