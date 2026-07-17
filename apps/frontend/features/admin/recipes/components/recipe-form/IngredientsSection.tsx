"use client";

import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldErrorId } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { faNum } from "@/lib/products";
import type { RecipeFormValues } from "@/features/recipes/validations";

export function IngredientsSection({
  control,
  register,
  errors,
}: {
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "ingredients",
  });

  return (
    <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <header className="mb-4">
        <h2 className="eyebrow">
          <ListChecks className="size-3.5" aria-hidden />
          مواد لازم
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          هر ماده را با مقدار و واحد آن فهرست کنید. ترتیب نمایش با جابه‌جایی
          ردیف‌ها تغییر می‌کند.
        </p>
      </header>
      <div className="flex flex-col gap-3">
        {fields.length === 0 ? (
          <p className="rounded-xl bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
            هنوز ماده‌ای اضافه نشده است.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {fields.map((f, i) => (
              <li
                key={f.id}
                className="grid items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border sm:grid-cols-[auto_1fr_1fr]"
              >
                <div className="flex items-center gap-1 self-center sm:flex-col sm:self-start sm:pt-7">
                  <span className="text-muted-foreground" aria-hidden>
                    <GripVertical className="size-4" />
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2 sm:grid sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label
                      htmlFor={`ingredients.${i}.ingredient_name`}
                      className="text-xs"
                    >
                      نام ماده
                    </Label>
                    <Input
                      id={`ingredients.${i}.ingredient_name`}
                      aria-invalid={!!errors.ingredients?.[i]?.ingredient_name}
                      aria-describedby={
                        errors.ingredients?.[i]?.ingredient_name
                          ? fieldErrorId(`ingredients.${i}.ingredient_name`)
                          : undefined
                      }
                      {...register(`ingredients.${i}.ingredient_name`)}
                    />
                    {errors.ingredients?.[i]?.ingredient_name ? (
                      <p
                        id={fieldErrorId(`ingredients.${i}.ingredient_name`)}
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {errors.ingredients[i]?.ingredient_name?.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`ingredients.${i}.quantity`}
                      className="text-xs"
                    >
                      مقدار
                    </Label>
                    <Input
                      id={`ingredients.${i}.quantity`}
                      dir="ltr"
                      placeholder="۶۰"
                      {...register(`ingredients.${i}.quantity`)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`ingredients.${i}.unit`}
                      className="text-xs"
                    >
                      واحد
                    </Label>
                    <Input
                      id={`ingredients.${i}.unit`}
                      placeholder="میلی‌لیتر"
                      {...register(`ingredients.${i}.unit`)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label
                      htmlFor={`ingredients.${i}.notes`}
                      className="text-xs"
                    >
                      یادداشت (اختیاری)
                    </Label>
                    <Input
                      id={`ingredients.${i}.notes`}
                      placeholder="مثلاً تازه فشرده"
                      {...register(`ingredients.${i}.notes`)}
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Controller
                      control={control}
                      name={`ingredients.${i}.optional`}
                      render={({ field }) => (
                        <Switch
                          id={`ingredients.${i}.optional`}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="ماده اختیاری است"
                        />
                      )}
                    />
                    <Label
                      htmlFor={`ingredients.${i}.optional`}
                      className="text-xs font-normal"
                    >
                      اختیاری
                    </Label>
                    <div className="ms-auto flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="انتقال به بالا"
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="انتقال به پایین"
                        disabled={i === fields.length - 1}
                        onClick={() => move(i, i + 1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`حذف ماده ${faNum(i + 1)}`}
                        onClick={() => remove(i)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            append({
              ingredient_name: "",
              quantity: "",
              unit: "",
              notes: "",
              optional: false,
              product_variant_id: null,
            })
          }
        >
          <Plus className="size-4" /> افزودن ماده
        </Button>
      </div>
    </section>
  );
}
