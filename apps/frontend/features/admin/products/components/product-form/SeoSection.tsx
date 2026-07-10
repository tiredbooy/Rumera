"use client";

import { Search } from "lucide-react";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection } from "./FormLayout";
import type { ProductFormValues } from "../../validations";
import { TagSelector, type AdminTag } from "./TagSelector";

export function SeoSection({
  register,
  control,
  errors,
  tags,
}: {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  tags: AdminTag[];
}) {
  return (
    <FormSection title="سئو و متادیتا" icon={<Search />}>
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
      <TagSelector control={control} tags={tags} />
    </FormSection>
  );
}
