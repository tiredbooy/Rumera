import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";
import { FormField, FormSection } from "./form-layout";

export function HeroCtaFields({
  register,
  errors,
}: {
  register: UseFormRegister<HeroSlideFormValues>;
  errors: FieldErrors<HeroSlideFormValues>;
}) {
  return (
    <FormSection
      title="دکمه‌های فراخوان"
      description="نشانی را به‌صورت مسیر داخلی (مثلاً ‎/products) یا پیوند امن HTTPS وارد کنید."
    >
      <FormField
        id="cta_label"
        label="متن دکمهٔ اصلی"
        error={errors.cta_label?.message}
      >
        <Input
          id="cta_label"
          placeholder="مشاهده فروشگاه"
          {...register("cta_label")}
        />
      </FormField>
      <FormField
        id="cta_href"
        label="نشانی دکمهٔ اصلی"
        error={errors.cta_href?.message}
      >
        <Input
          id="cta_href"
          dir="ltr"
          placeholder="/products"
          {...register("cta_href")}
        />
      </FormField>
      <FormField
        id="secondary_cta_label"
        label="متن دکمهٔ فرعی"
        error={errors.secondary_cta_label?.message}
      >
        <Input
          id="secondary_cta_label"
          placeholder="دسته‌بندی‌ها"
          {...register("secondary_cta_label")}
        />
      </FormField>
      <FormField
        id="secondary_cta_href"
        label="نشانی دکمهٔ فرعی"
        error={errors.secondary_cta_href?.message}
      >
        <Input
          id="secondary_cta_href"
          dir="ltr"
          placeholder="/categories"
          {...register("secondary_cta_href")}
        />
      </FormField>
    </FormSection>
  );
}
