import { Controller } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { Ref } from "react";

import { Input } from "@/components/ui/input";
import { fieldDescriptionId, fieldErrorId } from "@/components/ui/field";
import { FlexibleImageInput } from "@/features/admin/uploads/components/flexible-image-input";
import type { FlexibleImageInputHandle } from "@/features/admin/uploads/types";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";
import { FormField, FormSection } from "./form-layout";

export function HeroResponsiveMediaFields({
  control,
  register,
  errors,
  ownerId,
  desktopRef,
  mobileRef,
  onDesktopStagedChange,
  onDesktopPreviewChange,
}: {
  control: Control<HeroSlideFormValues>;
  register: UseFormRegister<HeroSlideFormValues>;
  errors: FieldErrors<HeroSlideFormValues>;
  ownerId?: number | null;
  desktopRef: Ref<FlexibleImageInputHandle>;
  mobileRef: Ref<FlexibleImageInputHandle>;
  onDesktopStagedChange: (staged: boolean) => void;
  onDesktopPreviewChange: (url: string) => void;
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
              ref={desktopRef}
              id="image_url"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              owner={{ ownerType: "hero-slides", ownerId, role: "desktop" }}
              placeholder="/images/hero/slide-1.jpg یا بارگذاری فایل"
              ariaInvalid={!!errors.image_url}
              ariaDescribedBy={
                errors.image_url
                  ? fieldErrorId("image_url")
                  : fieldDescriptionId("image_url")
              }
              onStagedChange={onDesktopStagedChange}
              onPreviewChange={onDesktopPreviewChange}
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
              ref={mobileRef}
              id="mobile_image_url"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              owner={{ ownerType: "hero-slides", ownerId, role: "mobile" }}
              placeholder="/images/hero/slide-1-mobile.jpg یا بارگذاری فایل"
              ariaInvalid={!!errors.mobile_image_url}
              ariaDescribedBy={
                errors.mobile_image_url
                  ? fieldErrorId("mobile_image_url")
                  : undefined
              }
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
