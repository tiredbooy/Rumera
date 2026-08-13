"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  AdminCustomerApiError,
  createAdminUser,
} from "@/features/customers/client";
import type {
  AdminUserCreateInput,
  AdminUserRole,
  UserGender,
} from "@/features/customers/types";
import {
  adminUserCreateFormSchema,
  dateInputToApiValue,
  toAsciiDigits,
  trimmedOrNull,
  type AdminUserCreateFormValues,
} from "@/features/customers/validations";
import { ROLE_LABELS } from "@/lib/rbac/roles";

import { Field } from "./user-edit-form/Field";

const ROLE_OPTIONS: AdminUserRole[] = [
  "customer",
  "vendor",
  "admin",
  "staff",
];
const GENDER_OPTIONS: Array<{ value: UserGender; label: string }> = [
  { value: "female", label: "زن" },
  { value: "male", label: "مرد" },
  { value: "other", label: "دیگر" },
];

const DEFAULT_VALUES: AdminUserCreateFormValues = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  phone: "",
  national_code: "",
  birth_date: "",
  gender: "",
  role: "customer",
  is_active: true,
};

export function adminUserCreatePayload(
  values: AdminUserCreateFormValues,
): AdminUserCreateInput {
  const input: AdminUserCreateInput = {
    email: values.email.trim(),
    password: values.password,
    role: values.role,
    is_active: values.is_active,
  };

  const firstName = trimmedOrNull(values.first_name);
  const lastName = trimmedOrNull(values.last_name);
  const phone = trimmedOrNull(values.phone);
  const nationalCode = trimmedOrNull(values.national_code);
  const birthDate = dateInputToApiValue(values.birth_date);

  if (firstName) input.first_name = firstName;
  if (lastName) input.last_name = lastName;
  if (phone) input.phone = toAsciiDigits(phone);
  if (nationalCode) input.national_code = toAsciiDigits(nationalCode);
  if (birthDate) input.birth_date = birthDate;
  if (values.gender) input.gender = values.gender;

  return input;
}

export function UserCreateForm() {
  const router = useRouter();
  const {
    clearErrors,
    control,
    handleSubmit,
    register,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<AdminUserCreateFormValues>({
    resolver: zodResolver(adminUserCreateFormSchema),
    defaultValues: DEFAULT_VALUES,
    shouldFocusError: true,
  });
  const isActive = useWatch({ control, name: "is_active" });

  function applyServerErrors(error: unknown) {
    if (!(error instanceof AdminCustomerApiError)) {
      setError("root.server", {
        message: "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.",
      });
      toast.error("ساخت کاربر ناموفق بود.");
      return;
    }

    const knownFields = new Set<keyof AdminUserCreateFormValues>([
      "email",
      "password",
      "first_name",
      "last_name",
      "phone",
      "national_code",
      "birth_date",
      "gender",
      "role",
      "is_active",
    ]);
    const fieldErrors = Object.entries(error.fields ?? {}).filter(
      ([field, messages]) =>
        knownFields.has(field as keyof AdminUserCreateFormValues) &&
        messages.length > 0,
    );

    if (fieldErrors.length > 0) {
      fieldErrors.forEach(([field, messages]) => {
        setError(field as keyof AdminUserCreateFormValues, {
          type: "server",
          message: messages[0],
        });
      });
      const firstField = fieldErrors[0][0] as keyof AdminUserCreateFormValues;
      setTimeout(() => setFocus(firstField), 0);
    } else if (error.status === 409) {
      setError("root.server", {
        type: "server",
        message:
          "کاربری با یکی از اطلاعات یکتای واردشده وجود دارد. ایمیل، تلفن و کد ملی را بررسی کنید.",
      });
    } else {
      setError("root.server", {
        type: "server",
        message: error.message || "ساخت کاربر ناموفق بود.",
      });
    }

    toast.error(error.message || "ساخت کاربر ناموفق بود.");
  }

  async function onSubmit(values: AdminUserCreateFormValues) {
    clearErrors("root.server");
    try {
      const created = await createAdminUser(adminUserCreatePayload(values));
      toast.success("کاربر ساخته شد.");
      router.push(`/admin/customers/${created.user_id}`);
      router.refresh();
    } catch (error) {
      applyServerErrors(error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      noValidate
      aria-busy={isSubmitting}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <legend className="px-1 font-serif text-base">اطلاعات ورود</legend>
          <p className="-mt-0.5 text-xs leading-relaxed text-muted-foreground">
            ایمیل شناسهٔ ورود است و پس از ساخت از این بخش قابل تغییر نیست.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="email" label="ایمیل" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                dir="ltr"
                inputMode="email"
                autoComplete="off"
                placeholder="name@example.com"
                className="h-11"
                disabled={isSubmitting}
                {...register("email")}
              />
            </Field>
            <Field
              id="password"
              label="گذرواژه"
              error={errors.password?.message}
              hint="حداقل ۸ کاراکتر؛ گذرواژه فقط در همین درخواست به بک‌اند ارسال می‌شود."
            >
              <Input
                id="password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                className="h-11"
                disabled={isSubmitting}
                {...register("password")}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <legend className="px-1 font-serif text-base">مشخصات کاربر</legend>
          <p className="-mt-0.5 text-xs text-muted-foreground">
            این موارد اختیاری‌اند و بعداً نیز قابل ویرایش هستند.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              id="first_name"
              label="نام"
              error={errors.first_name?.message}
            >
              <Input
                id="first_name"
                autoComplete="off"
                className="h-11"
                disabled={isSubmitting}
                {...register("first_name")}
              />
            </Field>
            <Field
              id="last_name"
              label="نام خانوادگی"
              error={errors.last_name?.message}
            >
              <Input
                id="last_name"
                autoComplete="off"
                className="h-11"
                disabled={isSubmitting}
                {...register("last_name")}
              />
            </Field>
            <Field id="phone" label="تلفن" error={errors.phone?.message}>
              <Input
                id="phone"
                dir="ltr"
                inputMode="tel"
                placeholder="09120000000"
                className="h-11"
                disabled={isSubmitting}
                {...register("phone")}
              />
            </Field>
            <Field
              id="national_code"
              label="کد ملی"
              error={errors.national_code?.message}
            >
              <Input
                id="national_code"
                dir="ltr"
                inputMode="numeric"
                placeholder="۱۰ رقم"
                className="h-11"
                disabled={isSubmitting}
                {...register("national_code")}
              />
            </Field>
            <Field
              id="birth_date"
              label="تاریخ تولد"
              error={errors.birth_date?.message}
            >
              <Input
                id="birth_date"
                type="date"
                dir="ltr"
                className="h-11"
                disabled={isSubmitting}
                {...register("birth_date")}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gender">جنسیت</Label>
              <NativeSelect
                id="gender"
                className="w-full [&_[data-slot=native-select]]:h-11"
                disabled={isSubmitting}
                aria-invalid={errors.gender ? true : undefined}
                aria-describedby={
                  errors.gender ? fieldErrorId("gender") : undefined
                }
                {...register("gender")}
              >
                <NativeSelectOption value="">نامشخص</NativeSelectOption>
                {GENDER_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.gender?.message ? (
                <p
                  id={fieldErrorId("gender")}
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {errors.gender.message}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <legend className="px-1 font-serif text-base">نقش و وضعیت</legend>
          <div className="mt-3 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">نقش کاربر</Label>
              <NativeSelect
                id="role"
                className="w-full [&_[data-slot=native-select]]:h-11"
                disabled={isSubmitting}
                aria-invalid={errors.role ? true : undefined}
                aria-describedby={
                  errors.role ? fieldErrorId("role") : undefined
                }
                {...register("role")}
              >
                {ROLE_OPTIONS.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.role?.message ? (
                <p
                  id={fieldErrorId("role")}
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {errors.role.message}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  فقط «مدیر کل» می‌تواند وارد پنل مدیریت شود.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="is_active">وضعیت حساب</Label>
              <div className="flex min-h-11 items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2">
                <span className="text-sm">{isActive ? "فعال" : "غیرفعال"}</span>
                <Controller
                  control={control}
                  name="is_active"
                  render={({ field }) => (
                    <Switch
                      id="is_active"
                      ref={field.ref}
                      name={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                      aria-invalid={errors.is_active ? true : undefined}
                      aria-describedby={
                        errors.is_active ? fieldErrorId("is_active") : undefined
                      }
                    />
                  )}
                />
              </div>
              {errors.is_active?.message ? (
                <p
                  id={fieldErrorId("is_active")}
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {errors.is_active.message}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  حساب غیرفعال امکان ورود ندارد، اما در فهرست کاربران باقی
                  می‌ماند.
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <div className="rounded-2xl bg-primary/[0.06] p-4 text-sm ring-1 ring-primary/10">
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <p className="leading-relaxed text-muted-foreground">
              ایجاد حساب و هر تغییر بعدی در تاریخچهٔ مدیریتی همان کاربر ثبت
              می‌شود.
            </p>
          </div>
        </div>

        {errors.root?.server?.message ? (
          <div
            className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
            role="alert"
          >
            {errors.root.server.message}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="h-11 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            {isSubmitting ? "در حال ساخت…" : "ساخت کاربر"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting}
            onClick={() => router.push("/admin/customers")}
            className="h-11 cursor-pointer"
          >
            انصراف
          </Button>
        </div>
      </aside>
    </form>
  );
}
