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
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { MultiTagPicker } from "@/features/admin/shared/multi-tag-picker";
import {
  ProductPicker,
  type ProductPickerOption,
} from "@/features/admin/shared/product-picker";
import {
  CouponApiError,
  useCreateAdminCoupon,
  useUpdateAdminCoupon,
} from "@/features/coupons/api";
import type { Coupon } from "@/features/coupons/types";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { apiErrorMessage, localizeApiText } from "@/lib/api/user-facing-error";
import { cn } from "@/lib/utils";

import {
  couponMoneyHint,
  summarizeCouponOffer,
} from "../coupon-offer";
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

function MoneyInput({
  unit,
  hideUnit,
  children,
}: {
  id?: string;
  unit: string;
  hideUnit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {hideUnit ? null : (
        <span
          className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground"
          aria-hidden
        >
          {unit}
        </span>
      )}
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
  productOptions = [],
  categoryOptions = [],
}: {
  mode: "create" | "edit";
  coupon?: Coupon;
  /** Seeds labels for products already in scope (CF-2). */
  productOptions?: ProductPickerOption[];
  categoryOptions?: { id: number; title: string }[];
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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: couponFormDefaults(coupon),
  });

  const discountType = useWatch({ control, name: "discount_type" });
  const discountValue = useWatch({ control, name: "discount_value" }) ?? "";
  const maxDiscountAmount =
    useWatch({ control, name: "max_discount_amount" }) ?? "";
  const minOrderAmount = useWatch({ control, name: "min_order_amount" }) ?? "";
  const applicability = useWatch({ control, name: "applicability" });
  const offerSummary = summarizeCouponOffer({
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderAmount,
  });
  const busy = isSubmitting || createCoupon.isPending || updateCoupon.isPending;
  const guard = useUnsavedChangesGuard({ enabled: isDirty, isSaving: busy });

  function applyError(error: unknown) {
    const fallback = "ذخیرهٔ کد تخفیف ناموفق بود";
    const message = apiErrorMessage(error, fallback);
    const fields =
      error instanceof CouponApiError
        ? error.fields
        : error && typeof error === "object" && "fields" in error
          ? (error as CouponApiError).fields
          : undefined;
    let focused = false;
    for (const [key, messages] of Object.entries(fields ?? {})) {
      if (!formFields.has(key as keyof CouponFormValues)) continue;
      const raw = messages[0];
      if (!raw) continue;
      setError(
        key as keyof CouponFormValues,
        { message: localizeApiText(raw) || raw },
        { shouldFocus: !focused },
      );
      focused = true;
    }
    setFormError(message);
    toast.error(message);
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
      guard.release();
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
          label={
            discountType === "percentage"
              ? "درصد تخفیف"
              : discountType === "fixed_amount"
                ? "مقدار تخفیف (تومان)"
                : "مقدار تخفیف"
          }
          error={errors.discount_value?.message}
          hint={
            discountType === "free_shipping"
              ? "برای ارسال رایگان مقدار صفر است."
              : discountType === "fixed_amount"
                ? couponMoneyHint(discountValue) ?? undefined
                : undefined
          }
        >
          <MoneyInput
            id="discount_value"
            unit={discountType === "percentage" ? "٪" : "تومان"}
            hideUnit={discountType === "free_shipping"}
          >
            <Input
              id="discount_value"
              className="pe-14"
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
          </MoneyInput>
        </Field>
        {discountType === "percentage" ? (
          <Field
            id="max_discount_amount"
            label="سقف مبلغ تخفیف (تومان)"
            error={errors.max_discount_amount?.message}
            hint={
              couponMoneyHint(maxDiscountAmount) ?? "خالی یعنی بدون سقف"
            }
          >
            <MoneyInput id="max_discount_amount" unit="تومان">
              <Input
                id="max_discount_amount"
                className="pe-14"
                type="number"
                min={0.01}
                max={MAX_COUPON_MONEY}
                step="0.01"
                dir="ltr"
                {...register("max_discount_amount")}
              />
            </MoneyInput>
          </Field>
        ) : null}
        <Field
          id="min_order_amount"
          label="حداقل مبلغ سفارش (تومان)"
          error={errors.min_order_amount?.message}
          hint={couponMoneyHint(minOrderAmount) ?? undefined}
        >
          <MoneyInput id="min_order_amount" unit="تومان">
            <Input
              id="min_order_amount"
              className="pe-14"
              type="number"
              min={0}
              max={MAX_COUPON_MONEY}
              step="0.01"
              dir="ltr"
              {...register("min_order_amount")}
            />
          </MoneyInput>
        </Field>
        {offerSummary ? (
          <p
            role="status"
            className="rounded-xl bg-muted/50 px-3 py-2 text-sm sm:col-span-2"
          >
            {offerSummary}
          </p>
        ) : null}
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
          label="شروع اعتبار (شمسی)"
          error={errors.starts_at?.message}
          bindControl={false}
        >
          <Controller
            name="starts_at"
            control={control}
            render={({ field }) => (
              <JalaliDateTimeInput
                id="starts_at"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={busy}
                invalid={Boolean(errors.starts_at)}
              />
            )}
          />
        </Field>
        <Field
          id="expires_at"
          label="پایان اعتبار (شمسی)"
          error={errors.expires_at?.message}
          hint="خالی یعنی بدون تاریخ پایان"
          bindControl={false}
        >
          <Controller
            name="expires_at"
            control={control}
            render={({ field }) => (
              <JalaliDateTimeInput
                id="expires_at"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={busy}
                invalid={Boolean(errors.expires_at)}
              />
            )}
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
            <div className="sm:col-span-2">
              <Controller
                name="product_ids"
                control={control}
                render={({ field }) => {
                  const selected = field.value
                    .split(",")
                    .map((part) => Number(part.trim()))
                    .filter((id) => Number.isFinite(id) && id > 0);
                  // CF-2: searches the server as you type, so a coupon can be
                  // scoped to any product — not just the newest 100. Seeded with
                  // the already-selected products so an existing scope stays
                  // visible instead of silently vanishing from the picker while
                  // remaining live in the backend.
                  return (
                    <div>
                      <p className="mb-2 text-sm font-medium">محصول‌ها</p>
                      <ProductPicker
                        value={selected}
                        initialOptions={productOptions}
                        disabled={busy}
                        onChange={(next) => field.onChange(next.join(", "))}
                      />
                    </div>
                  );
                }}
              />
              {errors.product_ids?.message ? (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.product_ids.message}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  جستجو و انتخاب چند محصول به‌جای وارد کردن شناسه.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Controller
                name="category_ids"
                control={control}
                render={({ field }) => {
                  const selected = field.value
                    .split(",")
                    .map((part) => Number(part.trim()))
                    .filter((id) => Number.isFinite(id) && id > 0);
                  return (
                    <MultiTagPicker
                      label="دسته‌ها"
                      emptyLabel="دسته‌ای برای انتخاب بارگذاری نشده است."
                      options={categoryOptions}
                      value={selected}
                      disabled={busy}
                      onChange={(next) =>
                        field.onChange(next.join(", "))
                      }
                    />
                  );
                }}
              />
              {errors.category_ids?.message ? (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.category_ids.message}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  جستجو و انتخاب چند دسته به‌جای وارد کردن شناسه.
                </p>
              )}
            </div>
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

      <UnsavedChangesDialog {...guard.dialogProps} />
    </form>
  );
}
