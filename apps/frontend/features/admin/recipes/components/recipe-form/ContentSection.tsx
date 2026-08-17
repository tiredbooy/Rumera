"use client";

import { FileText } from "lucide-react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
} from "react-hook-form";

import { ContentPreview } from "@/components/admin/content-preview";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import type { RecipeFormValues } from "@/features/recipes/validations";

export function ContentSection({
  control,
  errors,
  disabled,
}: {
  control: Control<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  disabled?: boolean;
}) {
  // CE-1: the same string the public page renders, live and unsaved.
  const content = useWatch({ control, name: "content" }) ?? "";

  return (
    <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <header className="mb-4">
        <h2 className="eyebrow">
          <FileText className="size-3.5" aria-hidden />
          روش تهیه
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          مراحل آماده‌سازی را با قالب‌بندی غنی بنویسید.
        </p>
      </header>
      <Controller
        control={control}
        name="content"
        render={({ field }) => (
          <RichTextEditor
            id="content"
            value={field.value}
            onChange={field.onChange}
            ariaInvalid={!!errors.content}
            ariaDescribedBy={errors.content ? "content-error" : undefined}
            disabled={disabled}
          />
        )}
      />
      {errors.content ? (
        <p id="content-error" role="alert" className="mt-2 text-xs text-destructive">
          {errors.content.message}
        </p>
      ) : null}
      <ContentPreview
        content={content}
        emptyMessage="مراحل تهیهٔ این دستور هنوز ثبت نشده است."
      />
    </section>
  );
}
