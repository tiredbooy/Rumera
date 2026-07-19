"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ShippingApiError,
  useCreateAdminShippingMethod,
  useUpdateAdminShippingMethod,
} from "@/features/shipping/api";
import type { ShippingMethod } from "@/features/shipping/types";
import {
  MAX_DELIVERY_DAYS,
  MAX_SHIPPING_MONEY,
  MAX_SHIPPING_WEIGHT,
  shippingMethodFormDefaults,
  shippingMethodFormSchema,
  toCreateShippingMethodInput,
  toUpdateShippingMethodInput,
  type ShippingMethodFormValues,
} from "@/features/shipping/validations";

import { ShippingFormField, ShippingFormSection } from "./shipping-form-field";

const methodFields = new Set<keyof ShippingMethodFormValues>([
  "name",
  "carrier",
  "description",
  "rate_type",
  "base_rate",
  "free_above_amount",
  "min_delivery_days",
  "max_delivery_days",
  "max_weight_kg",
  "is_active",
]);

function rateLabel(rateType: ShippingMethodFormValues["rate_type"]): string {
  switch (rateType) {
    case "per_kg":
      return "نرخ هر کیلوگرم";
    case "percentage":
      return "درصد از مبلغ سفارش";
    case "free":
      return "نرخ (صفر)";
    default:
      return "نرخ ثابت";
  }
}

export function ShippingMethodForm({
  mode,
  zoneID,
  method,
}: {
  mode: "create" | "edit";
  zoneID: number;
  method?: ShippingMethod;
}) {
  const router = useRouter();
  const createMethod = useCreateAdminShippingMethod(zoneID);
  const updateMethod = useUpdateAdminShippingMethod(zoneID);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ShippingMethodFormValues>({
    resolver: zodResolver(shippingMethodFormSchema),
    defaultValues: shippingMethodFormDefaults(method),
  });
  const rateType = useWatch({ control, name: "rate_type" });
  const busy = isSubmitting || createMethod.isPending || updateMethod.isPending;

  function applyError(error: unknown) {
    if (error instanceof ShippingApiError) {
      let focused = false;
      for (const [key, messages] of Object.entries(error.fields ?? {})) {
        if (!methodFields.has(key as keyof ShippingMethodFormValues)) continue;
        setError(
          key as keyof ShippingMethodFormValues,
          { message: messages[0] },
          { shouldFocus: !focused },
        );
        focused = true;
      }
      setFormError(error.message);
      toast.error(error.message);
      return;
    }
    setFormError("ذخیرهٔ روش ارسال ناموفق بود");
    toast.error("ذخیرهٔ روش ارسال ناموفق بود");
  }

  async function onSubmit(values: ShippingMethodFormValues) {
    setFormError(null);
    try {
      if (mode === "create") {
        await createMethod.mutateAsync(toCreateShippingMethodInput(values));
        toast.success("روش ارسال ساخته شد");
      } else {
        if (!method) return;
        await updateMethod.mutateAsync({
          id: method.id,
          input: toUpdateShippingMethodInput(values, method),
        });
        toast.success("تغییرات روش ارسال ذخیره شد");
      }
      router.push(`/admin/shipping/${zoneID}`);
      router.refresh();
    } catch (error) {
      applyError(error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex min-w-0 max-w-5xl flex-col gap-6"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {formError}
        </p>
      ) : null}

      <ShippingFormSection title="هویت روش ارسال">
        <ShippingFormField
          id="method-name"
          label="نام روش"
          error={errors.name?.message}
        >
          <Input
            id="method-name"
            autoComplete="off"
            disabled={busy}
            {...register("name")}
          />
        </ShippingFormField>
        <ShippingFormField
          id="method-carrier"
          label="حامل"
          error={errors.carrier?.message}
          hint="اختیاری؛ مانند پست یا تیپاکس"
        >
          <Input
            id="method-carrier"
            autoComplete="organization"
            disabled={busy}
            {...register("carrier")}
          />
        </ShippingFormField>
        <ShippingFormField
          id="method-description"
          label="توضیح قابل نمایش"
          error={errors.description?.message}
          full
        >
          <Textarea
            id="method-description"
            rows={3}
            disabled={busy}
            {...register("description")}
          />
        </ShippingFormField>
      </ShippingFormSection>

      <ShippingFormSection
        title="نرخ و آستانه"
        description="هزینهٔ تخمینی بر اساس نوع نرخ محاسبه می‌شود؛ نرخ درصدی از مبلغ سفارش و نرخ وزنی از وزن بسته استفاده می‌کند."
      >
        <ShippingFormField
          id="method-rate-type"
          label="نوع نرخ"
          error={errors.rate_type?.message}
          bindControl={false}
        >
          <Controller
            name="rate_type"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value === "free") {
                    setValue("base_rate", "0", { shouldValidate: true });
                    setValue("free_above_amount", "", {
                      shouldValidate: true,
                    });
                  }
                }}
                disabled={busy}
              >
                <SelectTrigger
                  ref={field.ref}
                  id="method-rate-type"
                  className="w-full"
                  onBlur={field.onBlur}
                  aria-invalid={errors.rate_type ? true : undefined}
                  aria-describedby={
                    errors.rate_type
                      ? fieldErrorId("method-rate-type")
                      : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat_rate">مبلغ ثابت</SelectItem>
                  <SelectItem value="per_kg">به‌ازای هر کیلوگرم</SelectItem>
                  <SelectItem value="percentage">درصد از مبلغ سفارش</SelectItem>
                  <SelectItem value="free">همیشه رایگان</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </ShippingFormField>
        <ShippingFormField
          id="method-base-rate"
          label={rateLabel(rateType)}
          error={errors.base_rate?.message}
          hint={rateType === "percentage" ? "عددی بین صفر تا ۱۰۰" : undefined}
        >
          <Input
            id="method-base-rate"
            type="number"
            min={0}
            max={rateType === "percentage" ? 100 : MAX_SHIPPING_MONEY}
            step="0.01"
            dir="ltr"
            readOnly={rateType === "free"}
            disabled={busy}
            {...register("base_rate")}
          />
        </ShippingFormField>
        {rateType !== "free" ? (
          <ShippingFormField
            id="method-free-above"
            label="ارسال رایگان از مبلغ"
            error={errors.free_above_amount?.message}
            hint="خالی یعنی این روش آستانهٔ رایگان ندارد"
            full
          >
            <Input
              id="method-free-above"
              type="number"
              min={0.01}
              max={MAX_SHIPPING_MONEY}
              step="0.01"
              dir="ltr"
              disabled={busy}
              {...register("free_above_amount")}
            />
          </ShippingFormField>
        ) : null}
      </ShippingFormSection>

      <ShippingFormSection
        title="محدودیت و زمان تحویل"
        description="مقادیر خالی به معنی نداشتن محدودیت یا برآورد مشخص هستند."
      >
        <ShippingFormField
          id="method-min-days"
          label="حداقل روز تحویل"
          error={errors.min_delivery_days?.message}
        >
          <Input
            id="method-min-days"
            type="number"
            min={0}
            max={MAX_DELIVERY_DAYS}
            step={1}
            dir="ltr"
            disabled={busy}
            {...register("min_delivery_days")}
          />
        </ShippingFormField>
        <ShippingFormField
          id="method-max-days"
          label="حداکثر روز تحویل"
          error={errors.max_delivery_days?.message}
        >
          <Input
            id="method-max-days"
            type="number"
            min={0}
            max={MAX_DELIVERY_DAYS}
            step={1}
            dir="ltr"
            disabled={busy}
            {...register("max_delivery_days")}
          />
        </ShippingFormField>
        <ShippingFormField
          id="method-max-weight"
          label="حداکثر وزن بسته (کیلوگرم)"
          error={errors.max_weight_kg?.message}
          hint="خالی یعنی بدون محدودیت وزن"
          full
        >
          <Input
            id="method-max-weight"
            type="number"
            min={0.01}
            max={MAX_SHIPPING_WEIGHT}
            step="0.01"
            dir="ltr"
            disabled={busy}
            {...register("max_weight_kg")}
          />
        </ShippingFormField>
      </ShippingFormSection>

      <ShippingFormSection title="فعال‌سازی">
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <div className="flex min-w-0 items-center justify-between gap-4 sm:col-span-2">
              <div className="min-w-0">
                <Label htmlFor="method-is-active">روش فعال باشد</Label>
                <p
                  id="method-is-active-description"
                  className="mt-1 text-xs leading-5 text-muted-foreground"
                >
                  روش غیرفعال در میان گزینه‌های ارسال مشتری نمایش داده نمی‌شود.
                </p>
              </div>
              <Switch
                id="method-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                disabled={busy}
                aria-describedby="method-is-active-description"
              />
            </div>
          )}
        />
      </ShippingFormSection>

      <div className="flex flex-wrap justify-end gap-2">
        {busy ? (
          <Button variant="outline" disabled>
            انصراف
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href={`/admin/shipping/${zoneID}`}>انصراف</Link>
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {mode === "create" ? "ساخت روش ارسال" : "ذخیرهٔ تغییرات"}
        </Button>
      </div>
    </form>
  );
}
