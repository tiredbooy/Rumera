"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Sun, Moon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { SmartImage } from "@/components/smart-image"
import { FlexibleImageInput } from "@/features/admin/uploads/components/flexible-image-input"
import { cn } from "@/lib/utils"
import {
  HeroSlideApiError,
  createHeroSlide,
  updateHeroSlide,
} from "@/features/hero-slides/api/client"
import type {
  AdminHeroSlide,
  CreateHeroSlideInput,
} from "@/features/hero-slides/types"
import {
  heroSlideFormSchema,
  type HeroSlideFormValues,
} from "@/features/hero-slides/validations"

// ── Validation (mirrors HeroSlideReq; strings coerced to the API shape on submit) ─

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null)

function defaults(slide?: AdminHeroSlide): HeroSlideFormValues {
  return {
    title: slide?.title ?? "",
    eyebrow: slide?.eyebrow ?? "",
    subtitle: slide?.subtitle ?? "",
    badge: slide?.badge ?? "",
    image_url: slide?.image_url ?? "",
    mobile_image_url: slide?.mobile_image_url ?? "",
    image_alt: slide?.image_alt ?? "",
    cta_label: slide?.cta_label ?? "",
    cta_href: slide?.cta_href ?? "",
    secondary_cta_label: slide?.secondary_cta_label ?? "",
    secondary_cta_href: slide?.secondary_cta_href ?? "",
    theme: slide?.theme ?? "dark",
    sort_order: slide?.sort_order != null ? String(slide.sort_order) : "0",
    is_active: slide?.is_active ?? true,
  }
}

// Maps backend json keys → form field names so a 422 lands on the right input.
const FIELD_MAP: Record<string, keyof HeroSlideFormValues> = {
  title: "title",
  eyebrow: "eyebrow",
  subtitle: "subtitle",
  badge: "badge",
  image_url: "image_url",
  mobile_image_url: "mobile_image_url",
  image_alt: "image_alt",
  cta_label: "cta_label",
  cta_href: "cta_href",
  secondary_cta_label: "secondary_cta_label",
  secondary_cta_href: "secondary_cta_href",
  theme: "theme",
  sort_order: "sort_order",
  is_active: "is_active",
}

// ── Layout helpers (mirror product-form's Section/Field) ──────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
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
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function HeroForm({
  mode,
  slide,
  submitLabel = "ذخیره",
}: {
  mode: "create" | "edit"
  slide?: AdminHeroSlide
  submitLabel?: string
}) {
  const router = useRouter()
  const [uploadsInFlight, setUploadsInFlight] = React.useState(0)
  const uploadBusy = uploadsInFlight > 0

  function handleUploadingChange(uploading: boolean) {
    setUploadsInFlight((count) => Math.max(0, count + (uploading ? 1 : -1)))
  }

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HeroSlideFormValues>({
    resolver: zodResolver(heroSlideFormSchema),
    defaultValues: defaults(slide),
  })

  // Live preview values.
  const imageUrl = watch("image_url")
  const title = watch("title")
  const eyebrow = watch("eyebrow")
  const subtitle = watch("subtitle")
  const badge = watch("badge")
  const ctaLabel = watch("cta_label")
  const secondaryCtaLabel = watch("secondary_cta_label")
  const imageAlt = watch("image_alt")

  function toPayload(v: HeroSlideFormValues): CreateHeroSlideInput {
    return {
      title: v.title.trim(),
      eyebrow: strOrNull(v.eyebrow),
      subtitle: strOrNull(v.subtitle),
      badge: strOrNull(v.badge),
      image_url: v.image_url.trim(),
      mobile_image_url: strOrNull(v.mobile_image_url),
      image_alt: strOrNull(v.image_alt),
      cta_label: strOrNull(v.cta_label),
      cta_href: strOrNull(v.cta_href),
      secondary_cta_label: strOrNull(v.secondary_cta_label),
      secondary_cta_href: strOrNull(v.secondary_cta_href),
      theme: v.theme,
      sort_order: v.sort_order.trim() === "" ? 0 : Number(v.sort_order),
      is_active: v.is_active,
    }
  }

  function applyServerErrors(e: unknown) {
    if (e instanceof HeroSlideApiError) {
      if (e.fields) {
        for (const [key, msgs] of Object.entries(e.fields)) {
          const field = FIELD_MAP[key]
          if (field) setError(field, { message: msgs[0] })
        }
      }
      toast.error(e.message)
    } else {
      toast.error("خطای غیرمنتظره رخ داد")
    }
  }

  async function onSubmit(v: HeroSlideFormValues) {
    try {
      const payload = toPayload(v)
      if (mode === "create") {
        await createHeroSlide(payload)
        toast.success("اسلاید ایجاد شد")
      } else if (slide) {
        await updateHeroSlide(slide.id, payload)
        toast.success("تغییرات ذخیره شد")
      }
      router.push("/admin/hero-slides")
      router.refresh()
    } catch (e) {
      applyServerErrors(e)
    }
  }

  const dark = watch("theme") === "dark"

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]"
    >
      <div className="flex flex-col gap-6">
        <Section title="محتوای اسلاید" description="عنوان روی تصویر بزرگ نمایش داده می‌شود.">
          <Field id="title" label="عنوان" error={errors.title?.message} full>
            <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
          </Field>
          <Field id="eyebrow" label="پیش‌عنوان" error={errors.eyebrow?.message}>
            <Input id="eyebrow" placeholder="فروشگاه منتخب رومرا" {...register("eyebrow")} />
          </Field>
          <Field id="badge" label="نشان (Badge)" error={errors.badge?.message}>
            <Input id="badge" placeholder="تازه‌ رسیده‌ها" {...register("badge")} />
          </Field>
          <Field id="subtitle" label="زیرعنوان" error={errors.subtitle?.message} full>
            <Textarea id="subtitle" rows={3} {...register("subtitle")} />
          </Field>
        </Section>

        <Section
          title="تصویر"
          description="تصویر دسکتاپ ۲۴۰۰×۱۳۵۰ (۱۶:۹) و تصویر موبایل ۱۰۸۰×۱۳۵۰ (۴:۵) پیشنهاد می‌شود."
        >
          <Field
            id="image_url"
            label="تصویر دسکتاپ"
            hint="یک نشانی وارد کنید یا فایل را بارگذاری کنید."
            error={errors.image_url?.message}
            full
          >
            <Controller
              control={control}
              name="image_url"
              render={({ field }) => (
                <FlexibleImageInput
                  id="image_url"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  folder="hero"
                  placeholder="/images/hero/slide-1.jpg یا بارگذاری فایل"
                  ariaInvalid={!!errors.image_url}
                  onUploadingChange={handleUploadingChange}
                />
              )}
            />
          </Field>
          <Field
            id="mobile_image_url"
            label="تصویر موبایل (اختیاری)"
            error={errors.mobile_image_url?.message}
            full
          >
            <Controller
              control={control}
              name="mobile_image_url"
              render={({ field }) => (
                <FlexibleImageInput
                  id="mobile_image_url"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  folder="hero"
                  placeholder="/images/hero/slide-1-mobile.jpg یا بارگذاری فایل"
                  onUploadingChange={handleUploadingChange}
                />
              )}
            />
          </Field>
          <Field
            id="image_alt"
            label="متن جایگزین تصویر"
            hint="برای دسترس‌پذیری و سئو؛ تصویر را در یک جمله توصیف کنید."
            error={errors.image_alt?.message}
            full
          >
            <Input id="image_alt" placeholder="مجموعه منتخب رومرا" {...register("image_alt")} />
          </Field>
        </Section>

        <Section
          title="دکمه‌های فراخوان"
          description="نشانی‌ها را به‌صورت مسیر داخلی وارد کنید (مثلاً ‎/products)."
        >
          <Field id="cta_label" label="متن دکمهٔ اصلی" error={errors.cta_label?.message}>
            <Input id="cta_label" placeholder="مشاهده فروشگاه" {...register("cta_label")} />
          </Field>
          <Field id="cta_href" label="نشانی دکمهٔ اصلی" error={errors.cta_href?.message}>
            <Input id="cta_href" dir="ltr" placeholder="/products" {...register("cta_href")} />
          </Field>
          <Field
            id="secondary_cta_label"
            label="متن دکمهٔ فرعی"
            error={errors.secondary_cta_label?.message}
          >
            <Input
              id="secondary_cta_label"
              placeholder="دسته‌بندی‌ها"
              {...register("secondary_cta_label")}
            />
          </Field>
          <Field
            id="secondary_cta_href"
            label="نشانی دکمهٔ فرعی"
            error={errors.secondary_cta_href?.message}
          >
            <Input
              id="secondary_cta_href"
              dir="ltr"
              placeholder="/categories"
              {...register("secondary_cta_href")}
            />
          </Field>
        </Section>

        <Section title="نمایش و ترتیب">
          <Field
            id="sort_order"
            label="ترتیب نمایش"
            hint="عدد کوچک‌تر زودتر نمایش داده می‌شود."
            error={errors.sort_order?.message}
          >
            <Input
              id="sort_order"
              type="number"
              dir="ltr"
              aria-invalid={!!errors.sort_order}
              {...register("sort_order")}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Label htmlFor="theme-light">رنگ‌بندی متن روی تصویر</Label>
            <Controller
              control={control}
              name="theme"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="رنگ‌بندی متن">
                  {(
                    [
                      { value: "dark", label: "متن روشن", icon: Moon },
                      { value: "light", label: "متن تیره", icon: Sun },
                    ] as const
                  ).map((opt) => {
                    const active = field.value === opt.value
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        id={`theme-${opt.value}`}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors",
                          "focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4" /> {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3 sm:col-span-2">
            <div>
              <Label htmlFor="is_active">نمایش در فروشگاه</Label>
              <p className="text-xs text-muted-foreground">
                اسلایدهای غیرفعال در کاروسل صفحهٔ اصلی نمایش داده نمی‌شوند.
              </p>
            </div>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  id="is_active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="وضعیت نمایش اسلاید"
                />
              )}
            />
          </div>
        </Section>
      </div>

      {/* Live preview + actions */}
      <aside className="flex flex-col gap-6">
        <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">پیش‌نمایش زنده</p>
              <span className="eyebrow text-xs text-muted-foreground">
                {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
              </span>
            </div>
            {/* Mimics the storefront hero proportions (16:9 desktop crop). */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
              <SmartImage
                src={imageUrl || null}
                alt={imageAlt || title || "پیش‌نمایش اسلاید"}
                sizes="400px"
                fallbackClassName="from-card via-card to-background"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/45 to-black/15" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
              <div className="absolute inset-0 flex items-center p-5">
                <div className="max-w-[80%] text-start text-white">
                  {eyebrow || badge ? (
                    <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold text-primary-foreground">
                      {badge ? (
                        <Badge className="bg-gold text-gold-foreground">{badge}</Badge>
                      ) : null}
                      {eyebrow ? <span className="text-white/90">{eyebrow}</span> : null}
                    </p>
                  ) : null}
                  <p className="font-serif text-xl leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.5)]">
                    {title || "عنوان اسلاید"}
                  </p>
                  {subtitle ? (
                    <p className="mt-1.5 line-clamp-2 text-xs text-white/85">{subtitle}</p>
                  ) : null}
                  {ctaLabel || secondaryCtaLabel ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {ctaLabel ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                          {ctaLabel} <ArrowLeft className="size-3" />
                        </span>
                      ) : null}
                      {secondaryCtaLabel ? (
                        <span className="inline-flex items-center rounded-md border border-white/40 bg-white/10 px-2.5 py-1 text-[11px] text-white backdrop-blur-md">
                          {secondaryCtaLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="px-4 py-2.5 text-center text-[11px] text-muted-foreground">
              نمای تقریبی از کاروسل صفحهٔ اصلی
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={isSubmitting || uploadBusy}>
              {isSubmitting || uploadBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting || uploadBusy}
              onClick={() => router.push("/admin/hero-slides")}
            >
              انصراف
            </Button>
          </div>
        </div>
      </aside>
    </form>
  )
}
