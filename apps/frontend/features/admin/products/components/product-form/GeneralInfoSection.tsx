"use client";

import { Info } from "lucide-react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldErrorId } from "@/components/ui/field";
import { SearchableIdSelect } from "@/features/admin/shared/searchable-id-select";
import type { Category } from "@/features/catalog/categories/types";
import { BrandSelect, type BrandOption } from "./BrandSelect";
import { categorySelectOptions } from "./category-select-options";
import { FormField, FormSection } from "./FormLayout";
import type { ProductFormValues } from "../../validations";

export function GeneralInfoSection({
  register,
  control,
  errors,
  categories,
  selectedBrand,
  onBrandChange,
}: {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  /** The whole tree, not a page of it — see `loadProductLookups` (PE-4). */
  categories: Category[];
  selectedBrand?: BrandOption | null;
  onBrandChange?: (brand: BrandOption | null) => void;
}) {
  return (
    <FormSection title="اطلاعات کلی" icon={<Info />}>
      <FormField
        id="title"
        label="نام محصول"
        error={errors.title?.message}
        full
      >
        <Input
          id="title"
          placeholder="مثلاً ویسکی آوبانه ۱۸ ساله"
          {...register("title")}
          aria-invalid={!!errors.title}
        />
      </FormField>

      <FormField
        id="slug"
        label="نامک (انگلیسی)"
        hint="در آدرس صفحه استفاده می‌شود"
        error={errors.slug?.message}
      >
        <Input
          id="slug"
          dir="ltr"
          placeholder="aobane-18-year"
          {...register("slug")}
        />
      </FormField>

      <FormField
        id="code"
        label="کد محصول (SKU پایه)"
        error={errors.code?.message}
      >
        <Input
          id="code"
          dir="ltr"
          placeholder="RM-0001"
          {...register("code")}
        />
      </FormField>

      <FormField
        id="category_id"
        label="دسته‌بندی"
        error={errors.category_id?.message}
      >
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => (
            <SearchableIdSelect
              id="category_id"
              value={field.value || ""}
              onChange={field.onChange}
              options={categorySelectOptions(categories)}
              placeholder="انتخاب دسته"
              noneLabel="بدون دسته"
              searchPlaceholder="جستجوی دسته‌بندی…"
              invalid={Boolean(errors.category_id)}
              describedBy={
                errors.category_id ? fieldErrorId("category_id") : undefined
              }
            />
          )}
        />
      </FormField>

      <FormField
        id="brand_id"
        label="برند / سازنده"
        error={errors.brand_id?.message}
      >
        <Controller
          control={control}
          name="brand_id"
          render={({ field }) => (
            <BrandSelect
              id="brand_id"
              value={field.value || ""}
              selectedBrand={selectedBrand}
              onChange={(next, brand) => {
                field.onChange(next);
                onBrandChange?.(brand);
              }}
              invalid={Boolean(errors.brand_id)}
              describedBy={
                errors.brand_id ? fieldErrorId("brand_id") : undefined
              }
            />
          )}
        />
      </FormField>

      <FormField
        id="country_of_origin"
        label="کشور سازنده"
        error={errors.country_of_origin?.message}
      >
        <Input
          id="country_of_origin"
          placeholder="اسکاتلند"
          {...register("country_of_origin")}
        />
      </FormField>

      <FormField
        id="description"
        label="توضیحات"
        error={errors.description?.message}
        full
      >
        <Textarea
          id="description"
          rows={4}
          placeholder="توضیح کوتاهی دربارهٔ محصول بنویسید…"
          {...register("description")}
        />
      </FormField>
    </FormSection>
  );
}
