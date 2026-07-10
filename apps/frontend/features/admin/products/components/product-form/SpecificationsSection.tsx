"use client";

import { FlaskConical } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormField, FormSection } from "./FormLayout";
import type { ProductFormValues } from "../../validations";

export function SpecificationsSection({
  register,
  errors,
}: {
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
}) {
  return (
    <FormSection title="مشخصات" icon={<FlaskConical />}>
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
        label="وزن"
        hint="گرم"
        error={errors.weight?.message}
      >
        <Input
          id="weight"
          type="number"
          min={0}
          dir="ltr"
          {...register("weight")}
        />
      </FormField>
    </FormSection>
  );
}
