"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ShippingApiError,
  useCreateAdminShippingZone,
  useUpdateAdminShippingZone,
} from "@/features/shipping/api";
import type { ShippingZone } from "@/features/shipping/types";
import {
  shippingZoneFormDefaults,
  shippingZoneFormSchema,
  toCreateShippingZoneInput,
  toUpdateShippingZoneInput,
  type ShippingZoneFormValues,
} from "@/features/shipping/validations";

import { RegionCodesEditor } from "./region-codes-editor";
import { ShippingFormField, ShippingFormSection } from "./shipping-form-field";

const zoneFields = new Set<keyof ShippingZoneFormValues>([
  "name",
  "description",
  "region_codes",
  "is_active",
]);

export function ShippingZoneForm({
  mode,
  zone,
}: {
  mode: "create" | "edit";
  zone?: ShippingZone;
}) {
  const router = useRouter();
  const createZone = useCreateAdminShippingZone();
  const updateZone = useUpdateAdminShippingZone();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShippingZoneFormValues>({
    resolver: zodResolver(shippingZoneFormSchema),
    defaultValues: shippingZoneFormDefaults(zone),
  });

  const busy = isSubmitting || createZone.isPending || updateZone.isPending;

  function applyError(error: unknown) {
    if (error instanceof ShippingApiError) {
      let focused = false;
      for (const [key, messages] of Object.entries(error.fields ?? {})) {
        if (!zoneFields.has(key as keyof ShippingZoneFormValues)) continue;
        setError(
          key as keyof ShippingZoneFormValues,
          { message: messages[0] },
          { shouldFocus: !focused },
        );
        focused = true;
      }
      setFormError(error.message);
      toast.error(error.message);
      return;
    }
    setFormError("ذخیرهٔ منطقهٔ ارسال ناموفق بود");
    toast.error("ذخیرهٔ منطقهٔ ارسال ناموفق بود");
  }

  async function onSubmit(values: ShippingZoneFormValues) {
    setFormError(null);
    try {
      if (mode === "create") {
        const created = await createZone.mutateAsync(
          toCreateShippingZoneInput(values),
        );
        toast.success("منطقهٔ ارسال ساخته شد؛ اکنون روش‌های آن را اضافه کنید");
        router.push(`/admin/shipping/${created.id}`);
      } else {
        if (!zone) return;
        await updateZone.mutateAsync({
          id: zone.id,
          input: toUpdateShippingZoneInput(values, zone),
        });
        toast.success("تغییرات منطقهٔ ارسال ذخیره شد");
        router.push("/admin/shipping");
      }
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

      <ShippingFormSection
        title="مشخصات منطقه"
        description="هر منطقه مجموعه‌ای از کدهای کشور، استان یا پیش‌شمارهٔ پستی را پوشش می‌دهد."
      >
        <ShippingFormField
          id="zone-name"
          label="نام منطقه"
          error={errors.name?.message}
        >
          <Input
            id="zone-name"
            autoComplete="off"
            disabled={busy}
            {...register("name")}
          />
        </ShippingFormField>
        <ShippingFormField
          id="zone-description"
          label="توضیح"
          error={errors.description?.message}
          full
        >
          <Textarea
            id="zone-description"
            rows={3}
            disabled={busy}
            {...register("description")}
          />
        </ShippingFormField>
      </ShippingFormSection>

      <ShippingFormSection
        title="محدودهٔ پوشش"
        description="استان‌های رایج را با یک کلیک اضافه کنید، یا کد دلخواه را تایپ و Enter بزنید. کدها هنگام ذخیره یکتا و حروف‌بزرگ می‌شوند."
      >
        <ShippingFormField
          id="zone-region-codes"
          label="کدهای منطقه"
          error={errors.region_codes?.message}
          hint="کدهای ذخیره‌شده: مثلاً IR-TEH یا IR. می‌توانید چند کد را با ویرگول هم بچسبانید."
          full
          bindControl={false}
        >
          <Controller
            name="region_codes"
            control={control}
            render={({ field }) => (
              <RegionCodesEditor
                ref={field.ref}
                id="zone-region-codes"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={busy}
                invalid={Boolean(errors.region_codes)}
                describedBy={
                  errors.region_codes
                    ? "zone-region-codes-error"
                    : "zone-region-codes-description"
                }
              />
            )}
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
                <Label htmlFor="zone-is-active">منطقه فعال باشد</Label>
                <p
                  id="zone-is-active-description"
                  className="mt-1 text-xs leading-5 text-muted-foreground"
                >
                  منطقهٔ غیرفعال و همهٔ روش‌های آن در انتخاب ارسال نمایش داده
                  نمی‌شوند.
                </p>
              </div>
              <Switch
                id="zone-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                disabled={busy}
                aria-describedby="zone-is-active-description"
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
            <Link href="/admin/shipping">انصراف</Link>
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {mode === "create" ? "ساخت منطقه" : "ذخیرهٔ تغییرات"}
        </Button>
      </div>
    </form>
  );
}
