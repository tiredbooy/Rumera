import { Controller } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { FlexibleImageInput } from "@/features/admin/uploads/components/flexible-image-input";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";
import { FormField, FormSection } from "./form-layout";

export function HeroResponsiveMediaFields({
  control,
  register,
  errors,
  onUploadingChange,
}: {
  control: Control<HeroSlideFormValues>;
  register: UseFormRegister<HeroSlideFormValues>;
  errors: FieldErrors<HeroSlideFormValues>;
  onUploadingChange: (uploading: boolean) => void;
}) {
  return (
    <FormSection
      title="تصویر"
      description="تصویر دسکتاپ ۲۴۰۰×۱۳۵۰ (۱۶:۹) و تصویر موبایل ۱۰۸۰×۱۳۵۰ (۴:۵) پیشنهاد می‌شود."
    >
      <FormField
        id="image_url"
        label="تصویر دسکتاپ"
        hint="یک نشانی وارد کنید یا فایل را بارگذاری کنید."
        error={errors.image_url?.message}
        full
      >
        <Controller
          control={control}
          name="image_url"
          render={({ field }) => (
            <FlexibleImageInput
              id="image_url"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              folder="hero"
              placeholder="/images/hero/slide-1.jpg یا بارگذاری فایل"
              ariaInvalid={!!errors.image_url}
              ariaDescribedBy={
                errors.image_url
                  ? fieldErrorId("image_url")
                  : fieldDescriptionId("image_url")
              }
              onUploadingChange={onUploadingChange}
            />
          )}
        />
      </FormField>
      <FormField
        id="mobile_image_url"
        label="تصویر موبایل (اختیاری)"
        error={errors.mobile_image_url?.message}
        full
      >
        <Controller
          control={control}
          name="mobile_image_url"
          render={({ field }) => (
            <FlexibleImageInput
              id="mobile_image_url"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              folder="hero"
              placeholder="/images/hero/slide-1-mobile.jpg یا بارگذاری فایل"
              ariaInvalid={!!errors.mobile_image_url}
              ariaDescribedBy={
                errors.mobile_image_url
                  ? fieldErrorId("mobile_image_url")
                  : undefined
              }
              onUploadingChange={onUploadingChange}
            />
          )}
        />
      </FormField>
      <FormField
        id="image_alt"
        label="متن جایگزین تصویر"
        hint="برای دسترس‌پذیری و سئو؛ تصویر را در یک جمله توصیف کنید."
        error={errors.image_alt?.message}
        full
      >
        <Input
          id="image_alt"
          placeholder="مجموعه منتخب رومرا"
          {...register("image_alt")}
        />
      </FormField>
    </FormSection>
  );
}
