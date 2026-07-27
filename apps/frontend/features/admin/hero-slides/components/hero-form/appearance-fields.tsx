import { Moon, Sun } from "lucide-react";
import { Controller } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";
import { cn } from "@/lib/utils";
import { FormField, FormSection } from "./form-layout";

export function HeroAppearanceFields({
  control,
  register,
  errors,
}: {
  control: Control<HeroSlideFormValues>;
  register: UseFormRegister<HeroSlideFormValues>;
  errors: FieldErrors<HeroSlideFormValues>;
}) {
  return (
    <FormSection
      title="انتشار و نمایش"
      description="بازهٔ زمانی اختیاری است و بر اساس منطقهٔ زمانی دستگاه شما ذخیره می‌شود."
    >
      <FormField
        id="sort_order"
        label="ترتیب نمایش"
        hint="عدد کوچک‌تر زودتر نمایش داده می‌شود."
        error={errors.sort_order?.message}
      >
        <Input
          id="sort_order"
          type="number"
          dir="ltr"
          aria-invalid={!!errors.sort_order}
          {...register("sort_order")}
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <Label htmlFor="theme-light">رنگ‌بندی متن روی تصویر</Label>
        <Controller
          control={control}
          name="theme"
          render={({ field }) => (
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="رنگ‌بندی متن"
            >
              {(
                [
                  { value: "dark", label: "متن روشن", icon: Moon },
                  { value: "light", label: "متن تیره", icon: Sun },
                ] as const
              ).map((opt) => {
                const active = field.value === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    id={`theme-${opt.value}`}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors",
                      "focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" /> {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        />
      </div>

      <FormField
        id="starts_at"
        label="شروع نمایش"
        hint="خالی یعنی نمایش بدون زمان شروع."
        error={errors.starts_at?.message}
      >
        <Input
          id="starts_at"
          type="datetime-local"
          step={1}
          dir="ltr"
          aria-invalid={!!errors.starts_at}
          {...register("starts_at")}
        />
      </FormField>

      <FormField
        id="ends_at"
        label="پایان نمایش"
        hint="خالی یعنی نمایش بدون زمان پایان."
        error={errors.ends_at?.message}
      >
        <Input
          id="ends_at"
          type="datetime-local"
          step={1}
          dir="ltr"
          aria-invalid={!!errors.ends_at}
          {...register("ends_at")}
        />
      </FormField>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3 sm:col-span-2">
        <div>
          <Label htmlFor="is_active">نمایش در فروشگاه</Label>
          <p className="text-xs text-muted-foreground">
            اسلایدهای غیرفعال در کاروسل صفحهٔ اصلی نمایش داده نمی‌شوند.
          </p>
        </div>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              id="is_active"
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label="وضعیت نمایش اسلاید"
            />
          )}
        />
      </div>
    </FormSection>
  );
}
