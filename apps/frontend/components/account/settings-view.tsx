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
  KeyRound,
  Trash2,
  Download,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useUpdateProfile } from "@/lib/api/account-hooks"
import { AccountSection } from "./account-section"

const profileSchema = z.object({
  name: z.string().trim().min(2, "نام را وارد کنید"),
  email: z.string().trim().email("ایمیل معتبر نیست"),
  phone_number: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شمارهٔ موبایل معتبر نیست")
    .or(z.literal("")),
})
type ProfileValues = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    current: z.string().min(1, "رمز فعلی را وارد کنید"),
    next: z.string().min(8, "رمز جدید حداقل ۸ کاراکتر باشد"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: "تکرار رمز مطابقت ندارد",
    path: ["confirm"],
  })
type PasswordValues = z.infer<typeof passwordSchema>

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

function ProfileTab({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const update = useUpdateProfile()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: defaultName, email: defaultEmail, phone_number: "" },
  })

  function onSubmit(values: ProfileValues) {
    update.mutate(
      { name: values.name, email: values.email, phone_number: values.phone_number || undefined },
      {
        onSuccess: () => toast.success("پروفایل به‌روزرسانی شد"),
        onError: () => toast.error("به‌روزرسانی هم‌اکنون در دسترس نیست"),
      }
    )
  }

  const initial = (defaultName || defaultEmail || "?").trim().charAt(0)

  return (
    <AccountSection title="اطلاعات شخصی" className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary/15 font-serif text-xl text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button type="button" variant="outline" size="sm" disabled>
              {/* TODO(api): wire avatar upload to uploadthing */}
              تغییر تصویر
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">به‌زودی</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">نام و نام خانوادگی</Label>
            <Input id="name" {...register("name")} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone_number">شمارهٔ تماس</Label>
            <Input id="phone_number" type="tel" dir="ltr" placeholder="09xxxxxxxxx" {...register("phone_number")} />
            {errors.phone_number ? (
              <p className="text-xs text-destructive">{errors.phone_number.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" dir="ltr" {...register("email")} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>
        </div>

        <div className="flex justify-start">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            ذخیرهٔ تغییرات
          </Button>
        </div>
      </form>
    </AccountSection>
  )
}

function SecurityTab() {
  const [twoFa, setTwoFa] = React.useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  })

  function onSubmit() {
    // TODO(api): wire to POST /api/v1/auth/password/change
    toast.success("رمز عبور به‌روزرسانی شد")
    reset()
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <AccountSection title="تغییر رمز عبور">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current">رمز فعلی</Label>
            <Input id="current" type="password" {...register("current")} />
            {errors.current ? <p className="text-xs text-destructive">{errors.current.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="next">رمز جدید</Label>
              <Input id="next" type="password" {...register("next")} />
              {errors.next ? <p className="text-xs text-destructive">{errors.next.message}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">تکرار رمز جدید</Label>
              <Input id="confirm" type="password" {...register("confirm")} />
              {errors.confirm ? <p className="text-xs text-destructive">{errors.confirm.message}</p> : null}
            </div>
          </div>
          <div className="flex justify-start">
            <Button type="submit">
              <KeyRound className="size-4" /> به‌روزرسانی رمز
            </Button>
          </div>
        </form>
      </AccountSection>

      <AccountSection title="ورود دومرحله‌ای">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">تأیید پیامکی هنگام ورود</p>
            <p className="text-xs text-muted-foreground">
              برای امنیت بیشتر، یک کد یک‌بارمصرف هنگام هر ورود دریافت کنید.
            </p>
          </div>
          <Switch
            checked={twoFa}
            onCheckedChange={(v) => {
              setTwoFa(v)
              // TODO(api): wire to 2FA enable/disable endpoint
              toast.success(v ? "ورود دومرحله‌ای فعال شد" : "ورود دومرحله‌ای غیرفعال شد")
            }}
            aria-label="ورود دومرحله‌ای"
          />
        </label>
      </AccountSection>
    </div>
  )
}

const NOTIFY_OPTIONS = [
  { key: "order_email", label: "ایمیل وضعیت سفارش", desc: "به‌روزرسانی پرداخت و ارسال", default: true },
  { key: "order_sms", label: "پیامک وضعیت سفارش", desc: "اطلاع لحظه‌ای تحویل", default: true },
  { key: "promo_email", label: "ایمیل پیشنهادها", desc: "تخفیف‌ها و محصولات تازه", default: false },
  { key: "loyalty", label: "اعلان باشگاه مشتریان", desc: "امتیاز و پاداش‌های جدید", default: true },
]

function NotificationsTab() {
  const [state, setState] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(NOTIFY_OPTIONS.map((o) => [o.key, o.default]))
  )

  return (
    <AccountSection
      title="اعلان‌ها"
      description="انتخاب کنید چه اطلاع‌رسانی‌هایی دریافت کنید."
      className="max-w-2xl"
      bodyClassName="divide-y divide-border/60 p-0"
    >
      {NOTIFY_OPTIONS.map((o) => (
        <label
          key={o.key}
          className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 sm:px-6"
        >
          <div>
            <p className="text-sm font-medium">{o.label}</p>
            <p className="text-xs text-muted-foreground">{o.desc}</p>
          </div>
          <Switch
            checked={state[o.key]}
            onCheckedChange={(v) => {
              setState((s) => ({ ...s, [o.key]: v }))
              // TODO(api): persist notification preferences
            }}
            aria-label={o.label}
          />
        </label>
      ))}
    </AccountSection>
  )
}

function PrivacyTab() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <AccountSection title="داده‌های شما">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">دریافت یک نسخه از اطلاعات</p>
            <p className="text-xs text-muted-foreground">سفارش‌ها، آدرس‌ها و فعالیت حساب شما.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => toast.info("لینک دانلود به ایمیل شما ارسال می‌شود")}
          >
            {/* TODO(api): wire to data-export endpoint */}
            <Download className="size-4" /> درخواست خروجی
          </Button>
        </div>
      </AccountSection>

      <AccountSection title="حذف حساب">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-destructive">حذف دائمی حساب کاربری</p>
            <p className="text-xs text-muted-foreground">
              تمام اطلاعات شما حذف می‌شود و این عمل قابل بازگشت نیست.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" /> حذف حساب
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف حساب کاربری</AlertDialogTitle>
                <AlertDialogDescription>
                  آیا کاملاً مطمئن هستید؟ با حذف حساب، تمام سفارش‌ها، امتیازها و موجودی کیف پول شما
                  از بین می‌رود و قابل بازیابی نیست.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>انصراف</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => toast.info("برای تکمیل حذف حساب با پشتیبانی تماس بگیرید")}
                >
                  {/* TODO(api): wire to account-deletion endpoint */}
                  حذف حساب
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AccountSection>
    </div>
  )
}
