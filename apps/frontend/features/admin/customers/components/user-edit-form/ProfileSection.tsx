import { Controller } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminUser, UserGender } from "@/features/customers/types";
import type { CustomerEditFormValues } from "@/features/customers/validations";
import { Field } from "./Field";

const GENDER_LABELS: Record<UserGender, string> = {
  male: "مرد",
  female: "زن",
  other: "دیگر",
};

const GENDER_OPTIONS: UserGender[] = ["male", "female", "other"];

export function ProfileSection({
  user,
  control,
  register,
  errors,
  disabled,
}: {
  user: AdminUser;
  control: Control<CustomerEditFormValues>;
  register: UseFormRegister<CustomerEditFormValues>;
  errors: FieldErrors<CustomerEditFormValues>;
  disabled: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6 disabled:opacity-70"
    >
      <legend className="px-1 font-serif text-base">مشخصات کاربر</legend>
      <p className="-mt-0.5 text-xs text-muted-foreground">
        اطلاعات هویتی و تماس این حساب.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id="first_name" label="نام" error={errors.first_name?.message}>
          <Input
            id="first_name"
            autoComplete="off"
            aria-invalid={!!errors.first_name}
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
            aria-invalid={!!errors.last_name}
            {...register("last_name")}
          />
        </Field>

        <Field
          id="email"
          label="ایمیل"
          hint="ایمیل از این بخش قابل ویرایش نیست."
        >
          <Input id="email" dir="ltr" value={user.email} disabled readOnly />
        </Field>
        <Field id="phone" label="تلفن" error={errors.phone?.message}>
          <Input
            id="phone"
            dir="ltr"
            inputMode="tel"
            placeholder="09120000000"
            aria-invalid={!!errors.phone}
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
            aria-invalid={!!errors.national_code}
            {...register("national_code")}
          />
        </Field>
        <Field
          id="birth_date"
          label="تاریخ تولد"
          error={errors.birth_date?.message}
        >
          <Controller
            control={control}
            name="birth_date"
            render={({ field }) => (
              <JalaliDateTimeInput
                id="birth_date"
                granularity="date"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={disabled}
                invalid={!!errors.birth_date}
              />
            )}
          />
        </Field>

        <Field id="gender" label="جنسیت" error={errors.gender?.message}>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                disabled={disabled}
                onValueChange={(val) =>
                  field.onChange(val === "none" ? "" : val)
                }
              >
                <SelectTrigger
                  id="gender"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className="w-full"
                  aria-invalid={errors.gender ? true : undefined}
                  aria-describedby={
                    errors.gender ? fieldErrorId("gender") : undefined
                  }
                >
                  <SelectValue placeholder="انتخاب جنسیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">نامشخص</SelectItem>
                  {GENDER_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
    </fieldset>
  );
}
