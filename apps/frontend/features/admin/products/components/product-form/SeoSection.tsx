"use client";

import { Search } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection } from "./FormLayout";
import type { ProductFormValues } from "../../validations";

export function SeoSection({
  register,
  errors,
}: {
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
}) {
  const hasError = Boolean(
    errors.meta_title || errors.meta_description || errors.meta_tags,
  );

  return (
    <FormSection
      sectionId="product-seo"
      title="سئو و متادیتا"
      description="نمایش محصول در موتورهای جست‌وجو"
      icon={<Search />}
      collapsible
      hasError={hasError}
    >
      <FormField
        id="meta_title"
        label="عنوان سئو"
        error={errors.meta_title?.message}
        full
      >
        <Input id="meta_title" {...register("meta_title")} />
      </FormField>
      <FormField
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
      </FormField>
      <FormField
        id="meta_tags"
        label="کلیدواژه‌ها"
        hint="با کاما جدا کنید"
        full
      >
        <Input
          id="meta_tags"
          placeholder="ویسکی، تک‌مالت، اسکاتلند"
          {...register("meta_tags")}
        />
      </FormField>
    </FormSection>
  );
}
