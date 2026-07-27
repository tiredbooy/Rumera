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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/features/catalog/categories/types";
import type { Brand } from "@/features/catalog/brands/types";
import { FormField, FormSection } from "./FormLayout";
import type { ProductFormValues } from "../../validations";

export function GeneralInfoSection({
  register,
  control,
  errors,
  categories,
  brands,
}: {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  categories: Category[];
  brands: Brand[];
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
            <Select
              value={field.value || "none"}
              onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
            >
              <SelectTrigger
                id="category_id"
                className="w-full"
                aria-invalid={Boolean(errors.category_id)}
                aria-describedby={
                  errors.category_id ? fieldErrorId("category_id") : undefined
                }
              >
                <SelectValue placeholder="انتخاب دسته" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون دسته</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c?.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select
              value={field.value || "none"}
              onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
            >
              <SelectTrigger
                id="brand_id"
                className="w-full"
                aria-invalid={Boolean(errors.brand_id)}
                aria-describedby={
                  errors.brand_id ? fieldErrorId("brand_id") : undefined
                }
              >
                <SelectValue placeholder="انتخاب برند" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون برند</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
