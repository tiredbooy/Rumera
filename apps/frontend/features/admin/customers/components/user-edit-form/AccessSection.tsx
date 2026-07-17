import { Info, ShieldAlert } from "lucide-react";
import { Controller, type Control } from "react-hook-form";

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
const ROLE_OPTIONS: AdminUserRole[] = ["customer", "vendor", "admin"];

export function AccessSection({
  control,
  watchedActive,
  watchedRole,
  isSelf,
}: {
  control: Control<CustomerEditFormValues>;
  watchedActive: CustomerEditFormValues["is_active"];
  watchedRole: CustomerEditFormValues["role"];
  isSelf: boolean;
}) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="px-1 font-serif text-base">دسترسی و نقش</legend>
      <p className="-mt-0.5 text-xs text-muted-foreground">
        نقش، سطح دسترسی این کاربر را در پنل تعیین می‌کند.
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
          hint={
            isSelf
              ? undefined
              : "تغییر نقش دسترسی‌های پنل را بلافاصله جابه‌جا می‌کند."
          }
        >
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSelf}
              >
                <SelectTrigger
                  id="role"
                  className="w-full"
                  aria-label="نقش کاربر"
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
              isSelf && "opacity-60",
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
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSelf}
                  aria-label="وضعیت فعال‌بودن حساب کاربر"
                />
              )}
            />
          </div>
          {!isSelf ? (
            <p className="text-xs text-muted-foreground">
              کاربر غیرفعال نمی‌تواند وارد حساب شود.
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
    </fieldset>
  );
}
