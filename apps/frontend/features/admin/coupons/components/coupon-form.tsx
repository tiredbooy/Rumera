"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
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
  CouponApiError,
  useCreateAdminCoupon,
  useUpdateAdminCoupon,
} from "@/features/coupons/api";
import type { Coupon } from "@/features/coupons/types";
import { cn } from "@/lib/utils";

import {
  couponFormDefaults,
  couponFormSchema,
  MAX_COUPON_MONEY,
  MAX_COUPON_USES,
  toCreateCouponInput,
  toUpdateCouponInput,
  type CouponFormValues,
} from "../validations";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="px-1 font-serif text-base">{title}</legend>
      {description ? (
        <p className="-mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  full,
  bindControl = true,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  full?: boolean;
  bindControl?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {bindControl ? (
        <FieldControl
          id={id}
          error={error}
          description={Boolean(hint && !error)}
        >
          {children as React.ReactElement}
        </FieldControl>
      ) : (
        children
      )}
      {error ? (
        <p
          id={fieldErrorId(id)}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={fieldDescriptionId(id)}
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const formFields = new Set<keyof CouponFormValues>([
  "code",
  "description",
  "discount_type",
  "discount_value",
  "max_discount_amount",
  "min_order_amount",
  "max_uses",
  "max_uses_per_user",
  "applicability",
  "product_ids",
  "category_ids",
  "is_active",
  "starts_at",
  "expires_at",
]);

export function CouponForm({
  mode,
  coupon,
}: {
  mode: "create" | "edit";
  coupon?: Coupon;
}) {
  const router = useRouter();
  const createCoupon = useCreateAdminCoupon();
  const updateCoupon = useUpdateAdminCoupon(coupon?.id ?? 0);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: couponFormDefaults(coupon),
  });

  const discountType = useWatch({ control, name: "discount_type" });
  const applicability = useWatch({ control, name: "applicability" });
  const busy = isSubmitting || createCoupon.isPending || updateCoupon.isPending;

  function applyError(error: unknown) {
    if (error instanceof CouponApiError) {
      let focused = false;
      for (const [key, messages] of Object.entries(error.fields ?? {})) {
        if (!formFields.has(key as keyof CouponFormValues)) continue;
        setError(
          key as keyof CouponFormValues,
          { message: messages[0] },
          { shouldFocus: !focused },
        );
        focused = true;
      }
      setFormError(error.message);
      toast.error(error.message);
      return;
    }
    setFormError("ذخیرهٔ کد تخفیف ناموفق بود");
    toast.error("ذخیرهٔ کد تخفیف ناموفق بود");
  }

  async function onSubmit(values: CouponFormValues) {
    setFormError(null);
    try {
      if (mode === "create") {
        await createCoupon.mutateAsync(toCreateCouponInput(values));
        toast.success("کد تخفیف ساخته شد");
      } else {
        if (!coupon) return;
        await updateCoupon.mutateAsync(toUpdateCouponInput(values, coupon));
        toast.success("تغییرات کد تخفیف ذخیره شد");
      }
      router.push("/admin/coupons");
      router.refresh();
    } catch (error) {
      applyError(error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-5xl flex-col gap-6"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {formError}
        </p>
      ) : null}

      <Section
        title="هویت و نوع تخفیف"
        description="کد و نوع تخفیف پس از ساخت ثابت می‌مانند."
      >
        <Field id="code" label="کد تخفیف" error={errors.code?.message}>
          <Input
            id="code"
            dir="ltr"
            autoComplete="off"
            readOnly={mode === "edit"}
            className="font-mono uppercase read-only:bg-muted"
            {...register("code")}
          />
        </Field>
        <Field
          id="discount_type"
          label="نوع تخفیف"
          error={errors.discount_type?.message}
          bindControl={false}
        >
          <Controller
            name="discount_type"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value === "free_shipping") {
                    setValue("discount_value", "0", { shouldValidate: true });
                  }
                  if (value !== "percentage") {
                    setValue("max_discount_amount", "", {
                      shouldValidate: true,
                    });
                  }
                }}
                disabled={mode === "edit"}
              >
                <SelectTrigger
                  ref={field.ref}
                  id="discount_type"
                  className="w-full"
                  onBlur={field.onBlur}
                  aria-invalid={errors.discount_type ? true : undefined}
                  aria-describedby={
                    errors.discount_type
                      ? fieldErrorId("discount_type")
                      : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">درصدی</SelectItem>
                  <SelectItem value="fixed_amount">مبلغ ثابت</SelectItem>
                  <SelectItem value="free_shipping">ارسال رایگان</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          id="description"
          label="توضیح داخلی"
          error={errors.description?.message}
          full
        >
          <Textarea id="description" rows={3} {...register("description")} />
        </Field>
      </Section>

      <Section title="ارزش و شرط سفارش">
        <Field
          id="discount_value"
          label={discountType === "percentage" ? "درصد تخفیف" : "مقدار تخفیف"}
          error={errors.discount_value?.message}
          hint={
            discountType === "free_shipping"
              ? "برای ارسال رایگان مقدار صفر است."
              : undefined
          }
        >
          <Input
            id="discount_value"
            type="number"
            min={0}
            max={
              discountType === "percentage"
                ? 100
                : discountType === "fixed_amount"
                  ? MAX_COUPON_MONEY
                  : 0
            }
            step="0.01"
            dir="ltr"
            readOnly={discountType === "free_shipping"}
            {...register("discount_value")}
          />
        </Field>
        {discountType === "percentage" ? (
          <Field
            id="max_discount_amount"
            label="سقف مبلغ تخفیف"
            error={errors.max_discount_amount?.message}
            hint="خالی یعنی بدون سقف"
          >
            <Input
              id="max_discount_amount"
              type="number"
              min={0.01}
              max={MAX_COUPON_MONEY}
              step="0.01"
              dir="ltr"
              {...register("max_discount_amount")}
            />
          </Field>
        ) : null}
        <Field
          id="min_order_amount"
          label="حداقل مبلغ سفارش"
          error={errors.min_order_amount?.message}
        >
          <Input
            id="min_order_amount"
            type="number"
            min={0}
            max={MAX_COUPON_MONEY}
            step="0.01"
            dir="ltr"
            {...register("min_order_amount")}
          />
        </Field>
      </Section>

      <Section title="محدودیت مصرف و بازهٔ اعتبار">
        <Field
          id="max_uses"
          label="حداکثر مصرف کل"
          error={errors.max_uses?.message}
          hint="خالی یعنی بدون محدودیت کل"
        >
          <Input
            id="max_uses"
            type="number"
            min={1}
            max={MAX_COUPON_USES}
            step={1}
            dir="ltr"
            {...register("max_uses")}
          />
        </Field>
        <Field
          id="max_uses_per_user"
          label="حداکثر مصرف هر کاربر"
          error={errors.max_uses_per_user?.message}
        >
          <Input
            id="max_uses_per_user"
            type="number"
            min={1}
            max={MAX_COUPON_USES}
            step={1}
            dir="ltr"
            {...register("max_uses_per_user")}
          />
        </Field>
        <Field
          id="starts_at"
          label="شروع اعتبار"
          error={errors.starts_at?.message}
        >
          <Input
            id="starts_at"
            type="datetime-local"
            step={1}
            dir="ltr"
            {...register("starts_at")}
          />
        </Field>
        <Field
          id="expires_at"
          label="پایان اعتبار"
          error={errors.expires_at?.message}
          hint="خالی یعنی بدون تاریخ پایان"
        >
          <Input
            id="expires_at"
            type="datetime-local"
            step={1}
            dir="ltr"
            {...register("expires_at")}
          />
        </Field>
      </Section>

      <Section
        title="دامنهٔ کاربرد"
        description="شناسه‌ها را با ویرگول جدا کنید؛ خالی گذاشتن هر دو فهرست مجاز نیست."
      >
        <Field
          id="applicability"
          label="اعمال روی"
          error={errors.applicability?.message}
          full
          bindControl={false}
        >
          <Controller
            name="applicability"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  ref={field.ref}
                  id="applicability"
                  className="w-full"
                  onBlur={field.onBlur}
                  aria-invalid={errors.applicability ? true : undefined}
                  aria-describedby={
                    errors.applicability
                      ? fieldErrorId("applicability")
                      : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همهٔ محصولات</SelectItem>
                  <SelectItem value="specific">
                    محصول‌ها یا دسته‌های مشخص
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        {applicability === "specific" ? (
          <>
            <Field
              id="product_ids"
              label="شناسه‌های محصول"
              error={errors.product_ids?.message}
              hint="مثال: ۱۲، ۱۸، ۲۴"
            >
              <Input id="product_ids" dir="ltr" {...register("product_ids")} />
            </Field>
            <Field
              id="category_ids"
              label="شناسه‌های دسته"
              error={errors.category_ids?.message}
              hint="مثال: ۳، ۷"
            >
              <Input
                id="category_ids"
                dir="ltr"
                {...register("category_ids")}
              />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="انتشار">
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 sm:col-span-2">
              <div>
                <Label htmlFor="is_active">کد فعال باشد</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  بازهٔ زمانی و محدودیت مصرف همچنان جداگانه بررسی می‌شوند.
                </p>
              </div>
              <Switch
                id="is_active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={busy}
              />
            </div>
          )}
        />
      </Section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/coupons">انصراف</Link>
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "create" ? "ساخت کد تخفیف" : "ذخیرهٔ تغییرات"}
        </Button>
      </div>
    </form>
  );
}
