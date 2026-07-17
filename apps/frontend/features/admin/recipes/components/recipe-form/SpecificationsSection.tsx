"use client";

import { Sparkles } from "lucide-react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RecipeDifficulty } from "@/features/recipes/types";
import { difficultyFa } from "@/features/recipes/utils";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { Field, Section } from "./FormLayout";

const difficultyOptions: RecipeDifficulty[] = ["easy", "medium", "hard"];

export function SpecificationsSection({
  control,
  register,
  errors,
}: {
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
}) {
  return (
    <Section
      icon={Sparkles}
      title="مشخصات"
      description="دشواری و زمان‌بندی تهیه."
    >
      <Field id="difficulty" label="سطح دشواری">
        <Controller
          control={control}
          name="difficulty"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="difficulty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficultyOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {difficultyFa[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        id="servings"
        label="تعداد سروینگ"
        error={errors.servings?.message}
      >
        <Input
          id="servings"
          type="number"
          dir="ltr"
          min={1}
          {...register("servings")}
        />
      </Field>
      <Field
        id="prep_time_minutes"
        label="زمان آماده‌سازی (دقیقه)"
        error={errors.prep_time_minutes?.message}
      >
        <Input
          id="prep_time_minutes"
          type="number"
          dir="ltr"
          min={0}
          {...register("prep_time_minutes")}
        />
      </Field>
      <Field
        id="cook_time_minutes"
        label="زمان پخت (دقیقه)"
        error={errors.cook_time_minutes?.message}
      >
        <Input
          id="cook_time_minutes"
          type="number"
          dir="ltr"
          min={0}
          {...register("cook_time_minutes")}
        />
      </Field>
    </Section>
  );
}
