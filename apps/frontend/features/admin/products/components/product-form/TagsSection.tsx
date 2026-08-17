"use client";

import { Tags } from "lucide-react";
import { useWatch, type Control, type FieldErrors } from "react-hook-form";

import type { ProductTag, Tag } from "@/features/catalog/tags/types";
import type { ProductFormValues } from "../../validations";
import { FormSection } from "./FormLayout";
import { TagSelector } from "./TagSelector";

export function TagsSection({
  control,
  errors,
  tags,
  initialTags,
  disabled,
}: {
  control: Control<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  tags?: Tag[];
  initialTags?: ProductTag[];
  disabled?: boolean;
}) {
  const error = errors.tag_ids?.message;
  const selectedTags = useWatch({ control, name: "tag_ids" }) ?? [];

  return (
    <FormSection
      sectionId="product-tags"
      title="برچسب‌های فروشگاهی"
      description="برای دسته‌بندی و کشف بهتر محصول در فروشگاه"
      icon={<Tags />}
      collapsible
      defaultOpen={Boolean(initialTags?.length)}
      hasError={Boolean(errors.tag_ids)}
      summary={
        selectedTags.length
          ? `${selectedTags.length.toLocaleString("fa-IR")} برچسب`
          : "بدون برچسب"
      }
    >
      <TagSelector
        control={control}
        availableTags={tags}
        initialTags={initialTags}
        disabled={disabled}
        error={typeof error === "string" ? error : undefined}
      />
    </FormSection>
  );
}
