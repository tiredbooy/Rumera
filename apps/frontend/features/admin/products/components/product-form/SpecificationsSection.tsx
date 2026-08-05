"use client";

import { FlaskConical } from "lucide-react";
import {
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormField, FormSection } from "./FormLayout";
import type { ProductFormValues } from "../../validations";

export function SpecificationsSection({
  register,
  control,
  errors,
}: {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
}) {
  const weightRaw = useWatch({ control, name: "weight" });
  const weightMissing =
    weightRaw == null || String(weightRaw).trim() === "";

  return (
    <FormSection
      sectionId="product-specifications"
      title="مشخصات"
      description="اطلاعات فیزیکی و مشخصات نوشیدنی — وزن برای محاسبهٔ هزینهٔ ارسال (کیلوگرم) استفاده می‌شود."
      icon={<FlaskConical />}
      collapsible
      defaultOpen={Boolean(errors.abv || errors.weight || weightMissing)}
      hasError={Boolean(errors.abv || errors.weight)}
    >
      <FormField
        id="abv"
        label="درصد الکل"
        hint="٪ ABV"
        error={errors.abv?.message}
      >
        <Input
          id="abv"
          type="number"
          step="0.1"
          min={0}
          max={100}
          dir="ltr"
          {...register("abv")}
        />
      </FormField>
      <FormField
        id="weight"
        label="وزن واحد (کیلوگرم)"
        hint="برای ارسال اجباری نیست ولی بدون آن هزینهٔ ارسال با وزن صفر محاسبه می‌شود"
        error={errors.weight?.message}
      >
        <Input
          id="weight"
          type="number"
          min={0}
          step="0.01"
          dir="ltr"
          placeholder="مثلاً 1.4"
          {...register("weight")}
        />
      </FormField>
      {weightMissing && !errors.weight ? (
        <p
          role="status"
          className="sm:col-span-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-950 dark:text-amber-100"
        >
          وزن ثبت نشده است. در تسویه حساب، وزن این محصول در جمع وزن بسته صفر
          در نظر گرفته می‌شود و ممکن است نرخ «به‌ازای کیلو» یا محدودیت وزن
          اشتباه اعمال شود.
        </p>
      ) : null}
    </FormSection>
  );
}
