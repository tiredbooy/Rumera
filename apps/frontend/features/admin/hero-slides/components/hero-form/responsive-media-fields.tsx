import { Controller } from "react-hook-form";
import type { Control, FieldErrors } from "react-hook-form";
import type { Ref } from "react";

import { fieldDescriptionId, fieldErrorId } from "@/components/ui/field";
import { ImageInput } from "@/features/image-uploader/ImageInput";
import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";
import { FormField, FormSection } from "./form-layout";

export function HeroResponsiveMediaFields({
  control,
  errors,
  ownerId,
  desktopRef,
  mobileRef,
  onDesktopStagedChange,
  onDesktopPreviewChange,
  onMobilePreviewChange,
  imageAlt,
  disabled,
}: {
  control: Control<HeroSlideFormValues>;
  errors: FieldErrors<HeroSlideFormValues>;
  ownerId?: number | null;
  desktopRef: Ref<ImageUploaderHandle<UploadedImage | null>>;
  mobileRef: Ref<ImageUploaderHandle<UploadedImage | null>>;
  onDesktopStagedChange: (staged: boolean) => void;
  onDesktopPreviewChange: (url: string) => void;
  onMobilePreviewChange: (url: string) => void;
  imageAlt: string;
  disabled?: boolean;
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
          render={({ field: imageField }) => (
            <Controller
              control={control}
              name="image_alt"
              render={({ field: altField }) => (
                <ImageInput
                  ref={desktopRef}
                  id="image_url"
                  name={imageField.name}
                  urlInputRef={imageField.ref}
                  value={imageField.value}
                  onChange={imageField.onChange}
                  onBlur={imageField.onBlur}
                  owner={{
                    ownerType: "hero-slides",
                    ownerId,
                    role: "desktop",
                  }}
                  placeholder="/images/hero/slide-1.jpg یا بارگذاری فایل"
                  ariaInvalid={!!errors.image_url}
                  ariaDescribedBy={
                    errors.image_url
                      ? fieldErrorId("image_url")
                      : fieldDescriptionId("image_url")
                  }
                  altValue={altField.value}
                  altInputId="image_alt"
                  altDescription="برای دسترس‌پذیری و سئو، تصویر را در یک جمله توصیف کنید."
                  altPlaceholder="مجموعه منتخب رومرا"
                  altError={errors.image_alt?.message}
                  onAltChange={altField.onChange}
                  onAltBlur={altField.onBlur}
                  onStagedChange={onDesktopStagedChange}
                  onPreviewChange={onDesktopPreviewChange}
                  disabled={disabled}
                />
              )}
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
          render={({ field: imageField }) => (
            <ImageInput
              ref={mobileRef}
              id="mobile_image_url"
              name={imageField.name}
              urlInputRef={imageField.ref}
              value={imageField.value}
              onChange={imageField.onChange}
              onBlur={imageField.onBlur}
              owner={{
                ownerType: "hero-slides",
                ownerId,
                role: "mobile",
              }}
              placeholder="/images/hero/slide-1-mobile.jpg یا بارگذاری فایل"
              ariaInvalid={!!errors.mobile_image_url}
              ariaDescribedBy={
                errors.mobile_image_url
                  ? fieldErrorId("mobile_image_url")
                  : undefined
              }
              altValue={imageAlt}
              onPreviewChange={onMobilePreviewChange}
              previewClassName="aspect-[4/5]"
              disabled={disabled}
            />
          )}
        />
      </FormField>
    </FormSection>
  );
}
