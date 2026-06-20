"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Loader2,
  User,
  ShieldCheck,
  Bell,
  Database,
  Clock,
  Mail,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useProfile, useUpdateProfile } from "@/lib/api/account-hooks"
import { AccountSection } from "./account-section"

const profileSchema = z.object({
  first_name: z.string().trim().min(2, "نام را وارد کنید"),
  last_name: z.string().trim().min(2, "نام خانوادگی را وارد کنید"),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شمارهٔ موبایل معتبر نیست")
    .or(z.literal("")),
})
type ProfileValues = z.infer<typeof profileSchema>

/** A small "coming soon" pill reused across the honest, not-yet-wired tabs. */
function ComingSoonBadge() {
  return (
    <Badge variant="outline" className="shrink-0">
      <Clock className="size-3" aria-hidden /> به‌زودی
    </Badge>
  )
}

export function SettingsView({
  defaultName,
  defaultEmail,
}: {
  defaultName: string
  defaultEmail: string
}) {
  return (
    <Tabs defaultValue="profile">
      <TabsList className="mb-6 flex-wrap">
        <TabsTrigger value="profile" className="cursor-pointer">
          <User className="size-4" /> پروفایل
        </TabsTrigger>
        <TabsTrigger value="security" className="cursor-pointer">
          <ShieldCheck className="size-4" /> امنیت
        </TabsTrigger>
        <TabsTrigger value="notifications" className="cursor-pointer">
          <Bell className="size-4" /> اعلان‌ها
        </TabsTrigger>
        <TabsTrigger value="privacy" className="cursor-pointer">
          <Database className="size-4" /> حریم خصوصی
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileTab defaultName={defaultName} defaultEmail={defaultEmail} />
      </TabsContent>
      <TabsContent value="security">
        <SecurityTab />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>
      <TabsContent value="privacy">
        <PrivacyTab />
      </TabsContent>
    </Tabs>
  )
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "", last: "" }
  if (parts.length === 1) return { first: parts[0], last: "" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

function ProfileTab({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  // Seed from the real profile endpoint (GET /auth/me); fall back to the
  // session-derived name/email until it loads or if it errors.
  const profile = useProfile()
  const update = useUpdateProfile()

  const seed = splitName(defaultName)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: seed.first, last_name: seed.last, phone: "" },
  })

  // Once the authoritative profile arrives, reseed the form (unless the user has
  // already started editing).
  React.useEffect(() => {
    if (!profile.data) return
    reset({
      first_name: profile.data.first_name ?? seed.first,
      last_name: profile.data.last_name ?? seed.last,
      phone: profile.data.phone ?? "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data])

  const email = profile.data?.email ?? defaultEmail
  const displayName =
    [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" ") || defaultName
  const initial = (displayName || email || "?").trim().charAt(0)

  function onSubmit(values: ProfileValues) {
    update.mutate(
      {
        first_name: values.first_name,
        last_name: values.last_name,
        // Empty string clears the phone (stored as NULL by the backend).
        phone: values.phone || null,
      },
      {
        onSuccess: (next) => {
          toast.success("پروفایل به‌روزرسانی شد")
          reset({
            first_name: next.first_name ?? values.first_name,
            last_name: next.last_name ?? values.last_name,
            phone: next.phone ?? "",
          })
        },
        onError: () => toast.error("به‌روزرسانی پروفایل ناموفق بود. دوباره تلاش کنید."),
      }
    )
  }

  if (profile.isLoading) {
    return (
      <AccountSection title="اطلاعات شخصی" className="max-w-2xl">
        <div className="grid gap-5">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10 sm:col-span-2" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
      </AccountSection>
    )
  }

  return (
    <AccountSection title="اطلاعات شخصی" className="max-w-2xl">
      {profile.isError ? (
        <p className="mb-4 text-sm text-muted-foreground">
          اطلاعات پروفایل از سرور دریافت نشد؛ مقادیر زیر از نشست شما پر شده است.{" "}
          <button
            type="button"
            onClick={() => profile.refetch()}
            className="cursor-pointer font-medium text-primary hover:underline"
          >
            تلاش دوباره
          </button>
        </p>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary/15 font-serif text-xl text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled>
                تغییر تصویر
              </Button>
              <ComingSoonBadge />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              آپلود تصویر پروفایل به‌زودی فعال می‌شود.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="first_name">نام</Label>
            <Input id="first_name" {...register("first_name")} />
            {errors.first_name ? (
              <p className="text-xs text-destructive">{errors.first_name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="last_name">نام خانوادگی</Label>
            <Input id="last_name" {...register("last_name")} />
            {errors.last_name ? (
              <p className="text-xs text-destructive">{errors.last_name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">شمارهٔ تماس</Label>
            <Input
              id="phone"
              type="tel"
              dir="ltr"
              placeholder="09xxxxxxxxx"
              className="text-start"
              {...register("phone")}
            />
            {errors.phone ? (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              className="text-start"
              value={email}
              readOnly
              disabled
              aria-describedby="email-hint"
            />
            <p id="email-hint" className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="size-3" aria-hidden /> برای تغییر ایمیل با پشتیبانی تماس بگیرید.
            </p>
          </div>
        </div>

        <div className="flex justify-start">
          <Button type="submit" disabled={update.isPending || !isDirty} className="cursor-pointer">
            {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            ذخیرهٔ تغییرات
          </Button>
        </div>
      </form>
    </AccountSection>
  )
}

/**
 * ComingSoonRow — an honest, disabled control row. No fake success: the toggle /
 * button is visibly disabled and tagged "به‌زودی" so the customer is never told
 * something happened when it didn't.
 */
function ComingSoonRow({
  title,
  description,
  control,
}: {
  title: React.ReactNode
  description: React.ReactNode
  control?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {title} <ComingSoonBadge />
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  )
}

function SecurityTab() {
  return (
    <div className="flex max-w-2xl flex-col gap-6" aria-busy={false}>
      <AccountSection title="تغییر رمز عبور">
        <fieldset disabled className="grid gap-4">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              تغییر رمز از این بخش به‌زودی فعال می‌شود.
            </p>
            <ComingSoonBadge />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="current">رمز فعلی</Label>
            <Input id="current" type="password" autoComplete="current-password" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="next">رمز جدید</Label>
              <Input id="next" type="password" autoComplete="new-password" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">تکرار رمز جدید</Label>
              <Input id="confirm" type="password" autoComplete="new-password" />
            </div>
          </div>
          <div className="flex justify-start">
            <Button type="button" disabled>
              به‌روزرسانی رمز
            </Button>
          </div>
        </fieldset>
      </AccountSection>

      <AccountSection title="ورود دومرحله‌ای">
        <ComingSoonRow
          title="تأیید پیامکی هنگام ورود"
          description="برای امنیت بیشتر، یک کد یک‌بارمصرف هنگام هر ورود دریافت کنید."
          control={<Switch checked={false} disabled aria-label="ورود دومرحله‌ای (به‌زودی)" />}
        />
      </AccountSection>
    </div>
  )
}

const NOTIFY_OPTIONS = [
  { key: "order_email", label: "ایمیل وضعیت سفارش", desc: "به‌روزرسانی پرداخت و ارسال" },
  { key: "order_sms", label: "پیامک وضعیت سفارش", desc: "اطلاع لحظه‌ای تحویل" },
  { key: "promo_email", label: "ایمیل پیشنهادها", desc: "تخفیف‌ها و محصولات تازه" },
  { key: "loyalty", label: "اعلان باشگاه مشتریان", desc: "امتیاز و پاداش‌های جدید" },
]

function NotificationsTab() {
  return (
    <AccountSection
      title="اعلان‌ها"
      description="مدیریت اعلان‌ها به‌زودی در دسترس قرار می‌گیرد."
      className="max-w-2xl"
      bodyClassName="divide-y divide-border/60 p-0"
    >
      {NOTIFY_OPTIONS.map((o) => (
        <div key={o.key} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {o.label} <ComingSoonBadge />
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{o.desc}</p>
          </div>
          <Switch checked={false} disabled aria-label={`${o.label} (به‌زودی)`} />
        </div>
      ))}
    </AccountSection>
  )
}

function PrivacyTab() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <AccountSection title="داده‌های شما">
        <ComingSoonRow
          title="دریافت یک نسخه از اطلاعات"
          description="خروجی سفارش‌ها، آدرس‌ها و فعالیت حساب شما به‌زودی فعال می‌شود."
          control={
            <Button variant="outline" disabled>
              درخواست خروجی
            </Button>
          }
        />
      </AccountSection>

      <AccountSection title="حذف حساب">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium text-destructive">
              حذف دائمی حساب کاربری <ComingSoonBadge />
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              حذف خودکار حساب هنوز فعال نیست. برای حذف حساب، فعلاً با پشتیبانی تماس بگیرید.
            </p>
          </div>
          <Button variant="outline" className="text-destructive hover:text-destructive" disabled>
            حذف حساب
          </Button>
        </div>
      </AccountSection>
    </div>
  )
}
