"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2, ShieldAlert, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ROLE_LABELS } from "@/lib/rbac/roles"
import {
  AdminCustomerApiError,
  updateAdminUser,
} from "@/features/customers/client"
import type {
  AdminUser,
  AdminUserRole,
  AdminUserUpdateInput,
  UserGender,
} from "@/features/customers/types"
import {
  customerEditFormSchema,
  type CustomerEditFormValues,
} from "@/features/customers/validations"

/** Roles accepted by the admin user update validator. */
const ROLE_OPTIONS: AdminUserRole[] = ["customer", "vendor", "admin"]

const GENDER_LABELS: Record<UserGender, string> = {
  male: "مرد",
  female: "زن",
  other: "دیگر",
}
const GENDER_OPTIONS: UserGender[] = ["male", "female", "other"]

// ── Validation ────────────────────────────────────────────────────────────────
// Everything is a string in the form; coerced to the partial-patch API shape on
// submit. Keys mirror the backend json names so 422 field errors map 1:1.

/** Western/Persian digits → ASCII; strips non-digits for storage. */
function toAsciiDigits(v: string): string {
  return v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
}

/** ISO/RFC3339 → `YYYY-MM-DD` for the date input (empty on parse failure). */
function isoToDateInput(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` → RFC3339 at UTC midnight, or null when empty. */
function dateInputToRfc3339(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  return `${t}T00:00:00Z`
}

const strOrNull = (v: string) => (v.trim() === "" ? null : v.trim())

function defaults(user: AdminUser): CustomerEditFormValues {
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    phone: user.phone ?? "",
    national_code: user.national_code ?? "",
    birth_date: isoToDateInput(user.birth_date),
    gender: user.gender ?? "",
    role: user.role,
    is_active: user.is_active,
  }
}

function Field({
  id,
  label,
  error,
  children,
  hint,
  full,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function UserEditForm({
  user,
  /** True when the row being edited is the signed-in admin's own account. */
  isSelf,
}: {
  user: AdminUser
  isSelf: boolean
}) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CustomerEditFormValues>({
    resolver: zodResolver(customerEditFormSchema),
    defaultValues: defaults(user),
  })

  const watchedActive = useWatch({ control, name: "is_active" })
  const watchedRole = useWatch({ control, name: "role" })

  function applyServerErrors(e: unknown) {
    if (e instanceof AdminCustomerApiError) {
      if (e.status === 403 || e.code === "ACCESS_DENIED") {
        toast.error("شما اجازهٔ تغییر نقش یا وضعیت این حساب را ندارید.")
        return
      }
      if (e.status === 404 || e.code === "USER_NOT_FOUND") {
        toast.error("کاربر یافت نشد؛ ممکن است حذف یا غیرفعال شده باشد.")
        return
      }
      if (e.fields) {
        const known = new Set<keyof CustomerEditFormValues>([
          "first_name",
          "last_name",
          "phone",
          "national_code",
          "birth_date",
          "gender",
          "role",
          "is_active",
        ])
        for (const [key, msgs] of Object.entries(e.fields)) {
          if (known.has(key as keyof CustomerEditFormValues)) {
            setError(key as keyof CustomerEditFormValues, { message: msgs[0] })
          }
        }
      }
      toast.error(e.message || "ویرایش کاربر ناموفق بود.")
    } else {
      toast.error("خطای غیرمنتظره رخ داد.")
    }
  }

  async function onSubmit(v: CustomerEditFormValues) {
    const input: AdminUserUpdateInput = {
      first_name: strOrNull(v.first_name),
      last_name: strOrNull(v.last_name),
      phone: v.phone.trim() === "" ? null : toAsciiDigits(v.phone.trim()),
      national_code:
        v.national_code.trim() === "" ? null : toAsciiDigits(v.national_code.trim()),
      birth_date: dateInputToRfc3339(v.birth_date),
      gender: v.gender === "" ? null : v.gender,
    }
    // Role/status are admin-only and locked for self-edits — only send them when
    // editing someone else, so we never trip the server lock-out guard.
    if (!isSelf) {
      input.role = v.role
      input.is_active = v.is_active
    }

    try {
      const updated = await updateAdminUser(user.user_id, input)
      toast.success("تغییرات کاربر ذخیره شد.")
      // Re-baseline the form to the server truth (clears the dirty state).
      reset(defaults(updated))
      router.refresh()
    } catch (e) {
      applyServerErrors(e)
    }
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      noValidate
      data-testid="user-edit-form"
    >
      <div className="flex flex-col gap-6">
        {/* ── Profile ─────────────────────────────────────────────── */}
        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
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
            <Field id="last_name" label="نام خانوادگی" error={errors.last_name?.message}>
              <Input
                id="last_name"
                autoComplete="off"
                aria-invalid={!!errors.last_name}
                {...register("last_name")}
              />
            </Field>

            <Field id="email" label="ایمیل" hint="ایمیل از این بخش قابل ویرایش نیست.">
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
            <Field id="birth_date" label="تاریخ تولد" error={errors.birth_date?.message}>
              <Input
                id="birth_date"
                type="date"
                dir="ltr"
                aria-invalid={!!errors.birth_date}
                {...register("birth_date")}
              />
            </Field>

            <Field id="gender" label="جنسیت">
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                  >
                    <SelectTrigger id="gender" className="w-full">
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

        {/* ── Access & role (RBAC-critical) ───────────────────────── */}
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
              hint={isSelf ? undefined : "تغییر نقش دسترسی‌های پنل را بلافاصله جابه‌جا می‌کند."}
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
                  isSelf && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    watchedActive
                      ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
                      : "bg-destructive/10 text-destructive ring-destructive/20"
                  )}
                  data-testid="user-status-badge"
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      watchedActive ? "bg-emerald-500" : "bg-destructive"
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
      </div>

      {/* ── Summary / actions ─────────────────────────────────────── */}
      <aside className="flex flex-col gap-6">
        <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
          <div className="border-hairline rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/[0.04]">
            <span
              className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15 font-serif text-2xl text-primary"
              aria-hidden
            >
              {(fullName || user.email).trim().charAt(0).toUpperCase()}
            </span>
            <p className="mt-3 font-medium">{fullName || "بدون نام"}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {user.email}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {ROLE_LABELS[watchedRole] ?? ROLE_LABELS[user.role]}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              ذخیرهٔ تغییرات
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              onClick={() => router.push("/admin/customers")}
            >
              انصراف
            </Button>
          </div>
        </div>
      </aside>
    </form>
  )
}
