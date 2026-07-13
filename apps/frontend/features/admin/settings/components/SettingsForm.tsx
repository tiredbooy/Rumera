"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Store,
  Phone,
  Share2,
  Truck,
  Search,
  Wrench,
  Loader2,
  AlertTriangle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import {
  SettingsApiError,
  updateSiteSettings,
} from "@/features/settings/api/client"
import type {
  SiteSettings,
  UpdateSiteSettingsInput,
} from "@/features/settings/types"

// ── Validation ──────────────────────────────────────────────────────────────
// Every field is a string in the form (freeThreshold is a numeric string),
// coerced to the API shape on submit. The flat schema keys mirror the backend
// json names so the 422 `error.fields` map onto the inputs 1:1 via setError.

const emailish = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "ایمیل معتبر وارد کنید",
  })

const schema = z.object({
  // store
  name: z
    .string()
    .trim()
    .min(1, "نام فروشگاه الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  tagline: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  logoUrl: z.string().trim().max(2048, "حداکثر ۲۰۴۸ نویسه"),
  description: z.string().max(2000, "حداکثر ۲۰۰۰ نویسه"),
  // contact
  supportEmail: emailish,
  supportPhone: z.string().trim().max(40, "حداکثر ۴۰ نویسه"),
  address: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  workingHours: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  // social
  instagram: z.string().trim().max(255),
  telegram: z.string().trim().max(255),
  whatsapp: z.string().trim().max(255),
  twitter: z.string().trim().max(255),
  youtube: z.string().trim().max(255),
  linkedin: z.string().trim().max(255),
  // shipping
  freeThreshold: z
    .string()
    .refine(
      (v) =>
        v.trim() === "" ||
        (/^\d+$/.test(v.trim()) && Number.isInteger(Number(v)) && Number(v) >= 0),
      { message: "عدد صحیح و نامنفی وارد کنید" }
    ),
  note: z.string().max(1000, "حداکثر ۱۰۰۰ نویسه"),
  // seo
  defaultTitle: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  defaultDescription: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  ogImage: z.string().trim().max(2048, "حداکثر ۲۰۴۸ نویسه"),
  keywords: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  // maintenance
  enabled: z.boolean(),
  message: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
})

type FormValues = z.infer<typeof schema>

/** Backend json field name → flat form field. Used to map 422 errors onto inputs. */
const FIELD_KEYS = new Set<keyof FormValues>([
  "name",
  "tagline",
  "logoUrl",
  "description",
  "supportEmail",
  "supportPhone",
  "address",
  "workingHours",
  "instagram",
  "telegram",
  "whatsapp",
  "twitter",
  "youtube",
  "linkedin",
  "freeThreshold",
  "note",
  "defaultTitle",
  "defaultDescription",
  "ogImage",
  "keywords",
  "enabled",
  "message",
])

function defaults(s: SiteSettings): FormValues {
  return {
    name: s.store.name ?? "",
    tagline: s.store.tagline ?? "",
    logoUrl: s.store.logoUrl ?? "",
    description: s.store.description ?? "",
    supportEmail: s.contact.supportEmail ?? "",
    supportPhone: s.contact.supportPhone ?? "",
    address: s.contact.address ?? "",
    workingHours: s.contact.workingHours ?? "",
    instagram: s.social.instagram ?? "",
    telegram: s.social.telegram ?? "",
    whatsapp: s.social.whatsapp ?? "",
    twitter: s.social.twitter ?? "",
    youtube: s.social.youtube ?? "",
    linkedin: s.social.linkedin ?? "",
    freeThreshold: s.shipping.freeThreshold != null ? String(s.shipping.freeThreshold) : "",
    note: s.shipping.note ?? "",
    defaultTitle: s.seo.defaultTitle ?? "",
    defaultDescription: s.seo.defaultDescription ?? "",
    ogImage: s.seo.ogImage ?? "",
    keywords: s.seo.keywords ?? "",
    enabled: s.maintenance.enabled ?? false,
    message: s.maintenance.message ?? "",
  }
}

/** Flat form values → the full wholesale-replace payload (every group, every field). */
function toPayload(v: FormValues): UpdateSiteSettingsInput {
  return {
    store: {
      name: v.name.trim(),
      tagline: v.tagline.trim(),
      logoUrl: v.logoUrl.trim(),
      description: v.description,
    },
    contact: {
      supportEmail: v.supportEmail.trim(),
      supportPhone: v.supportPhone.trim(),
      address: v.address,
      workingHours: v.workingHours.trim(),
    },
    social: {
      instagram: v.instagram.trim(),
      telegram: v.telegram.trim(),
      whatsapp: v.whatsapp.trim(),
      twitter: v.twitter.trim(),
      youtube: v.youtube.trim(),
      linkedin: v.linkedin.trim(),
    },
    shipping: {
      freeThreshold: v.freeThreshold.trim() === "" ? 0 : Number(v.freeThreshold),
      note: v.note,
    },
    seo: {
      defaultTitle: v.defaultTitle.trim(),
      defaultDescription: v.defaultDescription,
      ogImage: v.ogImage.trim(),
      keywords: v.keywords,
    },
    maintenance: {
      enabled: v.enabled,
      message: v.message,
    },
  }
}

// ── Layout helpers (match product-form / user-edit-form) ─────────────────────

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="border-hairline max-w-2xl rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="px-1 font-serif text-base">{title}</legend>
      {description ? (
        <p className="-mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Field({
  id,
  label,
  error,
  hint,
  children,
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

const TABS = [
  { value: "store", label: "فروشگاه", icon: Store },
  { value: "contact", label: "تماس", icon: Phone },
  { value: "social", label: "شبکه‌ها", icon: Share2 },
  { value: "shipping", label: "ارسال", icon: Truck },
  { value: "seo", label: "سئو", icon: Search },
  { value: "maintenance", label: "تعمیر", icon: Wrench },
] as const

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(settings),
  })

  const maintenanceEnabled = watch("enabled")
  const freeThreshold = watch("freeThreshold")
  const thresholdPreview =
    freeThreshold.trim() !== "" && /^\d+$/.test(freeThreshold.trim())
      ? `معادل ${faNum(Number(freeThreshold))} تومان`
      : undefined

  function applyServerErrors(e: unknown) {
    if (e instanceof SettingsApiError) {
      if (e.fields) {
        for (const [key, msgs] of Object.entries(e.fields)) {
          if (FIELD_KEYS.has(key as keyof FormValues)) {
            setError(key as keyof FormValues, { message: msgs[0] })
          }
        }
      }
      toast.error(e.message || "ذخیرهٔ تنظیمات ناموفق بود.")
    } else {
      toast.error("خطای غیرمنتظره رخ داد.")
    }
  }

  async function onSubmit(v: FormValues) {
    try {
      const updated = await updateSiteSettings(toPayload(v))
      toast.success("تنظیمات سایت ذخیره شد.")
      // Re-baseline the form to the server truth (clears the dirty state).
      reset(defaults(updated))
      router.refresh()
    } catch (e) {
      applyServerErrors(e)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate data-testid="settings-form">
      <Tabs defaultValue="store">
        <TabsList>
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="cursor-pointer">
              <Icon className="size-4" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Store ──────────────────────────────────────────────── */}
        <TabsContent value="store" className="mt-5">
          <Panel title="اطلاعات فروشگاه" description="نام، شعار و معرفی فروشگاه.">
            <Field id="name" label="نام فروشگاه" error={errors.name?.message} full>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field id="tagline" label="شعار" error={errors.tagline?.message} full>
              <Input id="tagline" aria-invalid={!!errors.tagline} {...register("tagline")} />
            </Field>
            <Field
              id="logoUrl"
              label="نشانی لوگو"
              error={errors.logoUrl?.message}
              hint="نشانی کامل تصویر لوگو."
              full
            >
              <Input
                id="logoUrl"
                dir="ltr"
                placeholder="https://…"
                aria-invalid={!!errors.logoUrl}
                {...register("logoUrl")}
              />
            </Field>
            <Field id="description" label="معرفی فروشگاه" error={errors.description?.message} full>
              <Textarea id="description" rows={4} {...register("description")} />
            </Field>
          </Panel>
        </TabsContent>

        {/* ── Contact ────────────────────────────────────────────── */}
        <TabsContent value="contact" className="mt-5">
          <Panel title="اطلاعات تماس" description="راه‌های ارتباط مشتری با پشتیبانی.">
            <Field id="supportEmail" label="ایمیل پشتیبانی" error={errors.supportEmail?.message}>
              <Input
                id="supportEmail"
                type="email"
                dir="ltr"
                inputMode="email"
                placeholder="support@rumera.ir"
                aria-invalid={!!errors.supportEmail}
                {...register("supportEmail")}
              />
            </Field>
            <Field id="supportPhone" label="تلفن پشتیبانی" error={errors.supportPhone?.message}>
              <Input
                id="supportPhone"
                dir="ltr"
                inputMode="tel"
                placeholder="02191000000"
                aria-invalid={!!errors.supportPhone}
                {...register("supportPhone")}
              />
            </Field>
            <Field id="workingHours" label="ساعات کاری" error={errors.workingHours?.message}>
              <Input
                id="workingHours"
                placeholder="شنبه تا پنجشنبه، ۹ تا ۱۸"
                aria-invalid={!!errors.workingHours}
                {...register("workingHours")}
              />
            </Field>
            <Field id="address" label="نشانی" error={errors.address?.message} full>
              <Textarea id="address" rows={2} {...register("address")} />
            </Field>
          </Panel>
        </TabsContent>

        {/* ── Social ─────────────────────────────────────────────── */}
        <TabsContent value="social" className="mt-5">
          <Panel
            title="شبکه‌های اجتماعی"
            description="نشانی کامل صفحات. موارد خالی در فروشگاه نمایش داده نمی‌شوند."
          >
            <Field id="instagram" label="اینستاگرام" error={errors.instagram?.message}>
              <Input id="instagram" dir="ltr" placeholder="https://instagram.com/…" {...register("instagram")} />
            </Field>
            <Field id="telegram" label="تلگرام" error={errors.telegram?.message}>
              <Input id="telegram" dir="ltr" placeholder="https://t.me/…" {...register("telegram")} />
            </Field>
            <Field id="whatsapp" label="واتساپ" error={errors.whatsapp?.message}>
              <Input id="whatsapp" dir="ltr" placeholder="https://wa.me/…" {...register("whatsapp")} />
            </Field>
            <Field id="twitter" label="ایکس (توییتر)" error={errors.twitter?.message}>
              <Input id="twitter" dir="ltr" placeholder="https://x.com/…" {...register("twitter")} />
            </Field>
            <Field id="youtube" label="یوتیوب" error={errors.youtube?.message}>
              <Input id="youtube" dir="ltr" placeholder="https://youtube.com/…" {...register("youtube")} />
            </Field>
            <Field id="linkedin" label="لینکدین" error={errors.linkedin?.message}>
              <Input id="linkedin" dir="ltr" placeholder="https://linkedin.com/…" {...register("linkedin")} />
            </Field>
          </Panel>
        </TabsContent>

        {/* ── Shipping ───────────────────────────────────────────── */}
        <TabsContent value="shipping" className="mt-5">
          <Panel title="قوانین ارسال" description="آستانهٔ ارسال رایگان و توضیحات ارسال.">
            <Field
              id="freeThreshold"
              label="آستانهٔ ارسال رایگان (تومان)"
              error={errors.freeThreshold?.message}
              hint={thresholdPreview ?? "برای سفارش‌های بالای این مبلغ، ارسال رایگان است. صفر یعنی غیرفعال."}
            >
              <Input
                id="freeThreshold"
                type="text"
                dir="ltr"
                inputMode="numeric"
                placeholder="5000000"
                aria-invalid={!!errors.freeThreshold}
                {...register("freeThreshold")}
              />
            </Field>
            <Field id="note" label="توضیحات ارسال" error={errors.note?.message} full>
              <Textarea
                id="note"
                rows={3}
                placeholder="ارسال با بسته‌بندی ایمن و کنترل دما انجام می‌شود."
                {...register("note")}
              />
            </Field>
          </Panel>
        </TabsContent>

        {/* ── SEO ────────────────────────────────────────────────── */}
        <TabsContent value="seo" className="mt-5">
          <Panel
            title="سئو و متادیتا"
            description="مقادیر پیش‌فرض صفحاتی که متادیتای اختصاصی ندارند."
          >
            <Field id="defaultTitle" label="عنوان پیش‌فرض" error={errors.defaultTitle?.message} full>
              <Input id="defaultTitle" aria-invalid={!!errors.defaultTitle} {...register("defaultTitle")} />
            </Field>
            <Field
              id="defaultDescription"
              label="توضیحات پیش‌فرض"
              error={errors.defaultDescription?.message}
              full
            >
              <Textarea id="defaultDescription" rows={3} {...register("defaultDescription")} />
            </Field>
            <Field
              id="ogImage"
              label="تصویر اشتراک‌گذاری (OG)"
              error={errors.ogImage?.message}
              hint="نشانی تصویر پیش‌فرض هنگام اشتراک‌گذاری لینک‌ها."
              full
            >
              <Input
                id="ogImage"
                dir="ltr"
                placeholder="https://…"
                aria-invalid={!!errors.ogImage}
                {...register("ogImage")}
              />
            </Field>
            <Field
              id="keywords"
              label="کلیدواژه‌ها"
              error={errors.keywords?.message}
              hint="کلیدواژه‌ها را با کاما جدا کنید."
              full
            >
              <Input id="keywords" placeholder="ویسکی، شراب، نوشیدنی" {...register("keywords")} />
            </Field>
          </Panel>
        </TabsContent>

        {/* ── Maintenance ────────────────────────────────────────── */}
        <TabsContent value="maintenance" className="mt-5">
          <Panel
            title="حالت تعمیر و نگهداری"
            description="با فعال‌سازی، فروشگاه برای بازدیدکنندگان قفل می‌شود."
          >
            <div className="sm:col-span-2">
              <div
                className={cn(
                  "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition-colors",
                  maintenanceEnabled
                    ? "border-destructive/30 bg-destructive/10"
                    : "border-border/60 bg-muted/20"
                )}
              >
                <div className="min-w-0">
                  <Label htmlFor="enabled" className="text-sm font-medium">
                    فعال‌سازی حالت تعمیر
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    در این حالت فروشگاه از دسترس عموم خارج می‌شود.
                  </p>
                </div>
                <Controller
                  control={control}
                  name="enabled"
                  render={({ field }) => (
                    <Switch
                      id="enabled"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="فعال‌سازی حالت تعمیر و نگهداری"
                      className="cursor-pointer"
                    />
                  )}
                />
              </div>
            </div>

            {maintenanceEnabled ? (
              <div
                className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-destructive ring-1 ring-inset ring-destructive/20 sm:col-span-2"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="text-xs leading-relaxed">
                  هشدار: با ذخیرهٔ این تنظیمات، فروشگاه بلافاصله برای بازدیدکنندگان غیرفعال می‌شود.
                </p>
              </div>
            ) : null}

            <Field
              id="message"
              label="پیام حالت تعمیر"
              error={errors.message?.message}
              hint="پیامی که هنگام تعمیر به بازدیدکنندگان نمایش داده می‌شود."
              full
            >
              <Textarea
                id="message"
                rows={3}
                placeholder="فروشگاه در حال به‌روزرسانی است؛ به‌زودی بازمی‌گردیم."
                {...register("message")}
              />
            </Field>
          </Panel>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex max-w-2xl items-center gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting || !isDirty} className="cursor-pointer">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          ذخیرهٔ تنظیمات
        </Button>
        {isDirty ? (
          <p className="text-xs text-muted-foreground">تغییرات ذخیره‌نشده دارید.</p>
        ) : null}
      </div>
    </form>
  )
}
