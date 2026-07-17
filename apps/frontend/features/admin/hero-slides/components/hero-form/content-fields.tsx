import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";
import { FormField, FormSection } from "./form-layout";

export function HeroContentFields({
  register,
  errors,
}: {
  register: UseFormRegister<HeroSlideFormValues>;
  errors: FieldErrors<HeroSlideFormValues>;
}) {
  return (
    <FormSection
      title="محتوای اسلاید"
      description="عنوان روی تصویر بزرگ نمایش داده می‌شود."
    >
      <FormField id="title" label="عنوان" error={errors.title?.message} full>
        <Input
          id="title"
          {...register("title")}
          aria-invalid={!!errors.title}
        />
      </FormField>
      <FormField id="eyebrow" label="پیش‌عنوان" error={errors.eyebrow?.message}>
        <Input
          id="eyebrow"
          placeholder="فروشگاه منتخب رومرا"
          {...register("eyebrow")}
        />
      </FormField>
      <FormField id="badge" label="نشان (Badge)" error={errors.badge?.message}>
        <Input id="badge" placeholder="تازه‌ رسیده‌ها" {...register("badge")} />
      </FormField>
      <FormField
        id="subtitle"
        label="زیرعنوان"
        error={errors.subtitle?.message}
        full
      >
        <Textarea id="subtitle" rows={3} {...register("subtitle")} />
      </FormField>
    </FormSection>
  );
}
