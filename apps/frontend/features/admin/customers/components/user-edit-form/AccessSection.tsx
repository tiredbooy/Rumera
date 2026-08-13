import { Info, ShieldAlert } from "lucide-react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import { fieldErrorId } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AdminUserRole } from "@/features/customers/types";
import type { CustomerEditFormValues } from "@/features/customers/validations";
import { ROLE_LABELS } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";
import { Field } from "./Field";

/** Roles accepted by the admin user update validator. */
const ROLE_OPTIONS: AdminUserRole[] = [
  "customer",
  "vendor",
  "admin",
  "staff",
];

export function AccessSection({
  control,
  watchedActive,
  watchedRole,
  initialActive,
  isBanned,
  isSelf,
  errors,
  disabled,
}: {
  control: Control<CustomerEditFormValues>;
  watchedActive: CustomerEditFormValues["is_active"];
  watchedRole: CustomerEditFormValues["role"];
  initialActive: boolean;
  isBanned: boolean;
  isSelf: boolean;
  errors: FieldErrors<CustomerEditFormValues>;
  disabled: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6 disabled:opacity-70"
    >
      <legend className="px-1 font-serif text-base">دسترسی و نقش</legend>
      <p className="-mt-0.5 text-xs text-muted-foreground">
        فقط نقش «مدیر کل» اجازهٔ ورود به پنل مدیریت را دارد.
      </p>

      {isSelf ? (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-3.5 py-3 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400"
          role="note"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs leading-relaxed">
            شما نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          id="role"
          label="نقش کاربر"
          error={errors.role?.message}
          hint={
            isSelf
              ? undefined
              : "نقش‌های مشتری و فروشنده به پنل مدیریت دسترسی ندارند."
          }
        >
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSelf || disabled}
              >
                <SelectTrigger
                  id="role"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className="w-full"
                  aria-label="نقش کاربر"
                  aria-invalid={errors.role ? true : undefined}
                  aria-describedby={
                    errors.role ? fieldErrorId("role") : undefined
                  }
                >
                  <SelectValue placeholder="انتخاب نقش" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <Label htmlFor="is_active">وضعیت حساب</Label>
          <div
            className={cn(
              "flex min-h-9 items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2",
              (isSelf || initialActive || isBanned) && "opacity-60",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                watchedActive
                  ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive ring-destructive/20",
              )}
              data-testid="user-status-badge"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  watchedActive ? "bg-emerald-500" : "bg-destructive",
                )}
                aria-hidden
              />
              {watchedActive ? "فعال" : "غیرفعال"}
            </span>
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
                  onBlur={field.onBlur}
                  disabled={isSelf || initialActive || isBanned || disabled}
                  aria-label="وضعیت فعال‌بودن حساب کاربر"
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
          ) : isBanned ? (
            <p className="text-xs text-destructive">
              حساب مسدود است و از این بخش قابل فعال‌سازی نیست.
            </p>
          ) : !isSelf && !initialActive ? (
            <p className="text-xs text-muted-foreground">
              برای فعال‌سازی دوباره، وضعیت را روشن و تغییرات را ذخیره کنید.
            </p>
          ) : !isSelf ? (
            <p className="text-xs text-muted-foreground">
              غیرفعال‌سازی فقط از صفحهٔ جزئیات و پس از تأیید انجام می‌شود.
            </p>
          ) : null}
        </div>
      </div>

      {!isSelf && watchedRole === "admin" ? (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted/40 px-3.5 py-3 text-muted-foreground ring-1 ring-inset ring-border/60"
          role="note"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs leading-relaxed">
            نقش «مدیر کل» دسترسی کامل به پنل مدیریت می‌دهد. با احتیاط اعطا کنید.
          </p>
        </div>
      ) : null}
      {!isSelf && watchedRole === "staff" ? (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted/40 px-3.5 py-3 text-muted-foreground ring-1 ring-inset ring-border/60"
          role="note"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs leading-relaxed">
            نقش «اپراتور» فقط سطوحی را می‌بیند که در ماتریس دسترسی اعطا شده‌اند.
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
