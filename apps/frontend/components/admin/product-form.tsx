"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Brand, Category, ProductDetail } from "@/lib/catalog/types"
import {
  AdminApiError,
  createProduct,
  updateProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/api/admin-client"
import { OptimizedImage } from "@/components/admin/optimized-image"
import { ImageUploader, type ImageUploaderHandle } from "@/components/admin/image-uploader"

type AdminTag = { id: number; title: string }

// ── Validation (all fields are strings/arrays; coerced to the API shape on submit) ─

const numberish = (msg: string) =>
  z.string().refine((v) => v.trim() === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
    message: msg,
  })

const variantSchema = z.object({
  _id: z.number().optional(),
  sku: z.string().max(250),
  price: z
    .string()
    .refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "قیمت معتبر وارد کنید",
    }),
  compare_at_price: numberish("قیمت نامعتبر است"),
})

const schema = z.object({
  title: z.string().trim().min(1, "نام محصول الزامی است").max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z.string().trim().max(255),
  code: z.string().trim().max(80),
  description: z.string(),
  category_id: z.string(),
  brand_id: z.string(),
  country_of_origin: z.string().trim().max(100),
  abv: numberish("بین ۰ تا ۱۰۰").refine((v) => v.trim() === "" || Number(v) <= 100, {
    message: "حداکثر ۱۰۰",
  }),
  weight: numberish("وزن نامعتبر است"),
  is_active: z.boolean(),
  meta_title: z.string().trim().max(225),
  meta_description: z.string(),
  meta_tags: z.string(),
  tag_ids: z.array(z.number()),
  variants: z.array(variantSchema),
})

type FormValues = z.infer<typeof schema>

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null)
const numOrNull = (v?: string) => (v && v.trim() !== "" ? Number(v) : null)
const parseTags = (v: string) =>
  v
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean)

function defaults(product?: ProductDetail): FormValues {
  return {
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    code: product?.code ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ? String(product.category_id) : "",
    brand_id: product?.brand_id ? String(product.brand_id) : "",
    country_of_origin: product?.country_of_origin ?? "",
    abv: product?.abv != null ? String(product.abv) : "",
    weight: product?.weight != null ? String(product.weight) : "",
    is_active: product?.is_active ?? true,
    meta_title: product?.meta_title ?? "",
    meta_description: product?.meta_description ?? "",
    meta_tags: (product?.meta_tags ?? []).join("، "),
    tag_ids: (product?.tags ?? []).map((t) => t.id),
    variants: (product?.variants ?? []).map((v) => ({
      _id: v.id,
      sku: v.sku ?? "",
      price: String(v.price),
      compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : "",
    })),
  }
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5 sm:p-6">
      <legend className="px-1 font-serif text-lg">{title}</legend>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Field({
  id,
  label,
  error,
  children,
  full,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function ProductForm({
  mode,
  product,
  categories,
  brands,
  tags,
  submitLabel = "ذخیره",
}: {
  mode: "create" | "edit"
  product?: ProductDetail
  categories: Category[]
  brands: Brand[]
  tags: AdminTag[]
  submitLabel?: string
}) {
  const router = useRouter()
  const uploaderRef = React.useRef<ImageUploaderHandle>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(product),
  })

  const { fields, append, remove } = useFieldArray({ control, name: "variants" })
  const title = watch("title")
  const brandId = watch("brand_id")
  const brandName = brands.find((b) => String(b.id) === brandId)?.title

  const primaryImage = product?.images?.find((i) => i.is_primary) ?? product?.images?.[0]

  function toPayload(v: FormValues): CreateProductInput {
    return {
      title: v.title.trim(),
      code: strOrNull(v.code),
      slug: strOrNull(v.slug),
      category_id: numOrNull(v.category_id),
      description: strOrNull(v.description),
      brand_id: numOrNull(v.brand_id),
      country_of_origin: strOrNull(v.country_of_origin),
      abv: numOrNull(v.abv),
      weight: numOrNull(v.weight),
      meta_title: strOrNull(v.meta_title),
      meta_description: strOrNull(v.meta_description),
      meta_tags: parseTags(v.meta_tags),
      tag_ids: v.tag_ids,
    }
  }

  function applyServerErrors(e: unknown) {
    if (e instanceof AdminApiError) {
      if (e.fields) {
        for (const [key, msgs] of Object.entries(e.fields)) {
          setError(key as keyof FormValues, { message: msgs[0] })
        }
      }
      toast.error(e.message)
    } else {
      toast.error("خطای غیرمنتظره رخ داد")
    }
  }

  async function onSubmit(v: FormValues) {
    try {
      if (mode === "create") {
        const input: CreateProductInput = {
          ...toPayload(v),
          variants: v.variants.map((vr) => ({
            sku: strOrNull(vr.sku),
            price: Number(vr.price),
            compare_at_price: numOrNull(vr.compare_at_price),
          })),
        }
        const created = await createProduct(input)
        // Product exists now → upload any staged images against its id.
        await uploaderRef.current?.flush(created.id)
        toast.success("محصول ایجاد شد")
        router.push(`/admin/products/${created.id}`)
        router.refresh()
      } else if (product) {
        const input: UpdateProductInput = { ...toPayload(v), is_active: v.is_active }
        await updateProduct(product.id, input)

        // Reconcile variants against the originals.
        const original = product.variants ?? []
        const kept = new Set(v.variants.filter((x) => x._id).map((x) => x._id))
        await Promise.all(
          original.filter((ov) => !kept.has(ov.id)).map((ov) => deleteVariant(ov.id))
        )
        for (const vr of v.variants) {
          const body = {
            sku: strOrNull(vr.sku),
            price: Number(vr.price),
            compare_at_price: numOrNull(vr.compare_at_price),
          }
          if (vr._id) await updateVariant(vr._id, body)
          else await createVariant(product.id, body)
        }

        await uploaderRef.current?.flush(product.id)
        toast.success("تغییرات ذخیره شد")
        router.refresh()
      }
    } catch (e) {
      applyServerErrors(e)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <Section title="اطلاعات کلی">
          <Field id="title" label="نام محصول" error={errors.title?.message} full>
            <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
          </Field>
          <Field id="slug" label="نامک (انگلیسی)" error={errors.slug?.message}>
            <Input id="slug" dir="ltr" placeholder="aobane-18-year" {...register("slug")} />
          </Field>
          <Field id="code" label="کد محصول (SKU پایه)" error={errors.code?.message}>
            <Input id="code" dir="ltr" {...register("code")} />
          </Field>
          <Field id="category_id" label="دسته‌بندی">
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                >
                  <SelectTrigger id="category_id" className="w-full">
                    <SelectValue placeholder="انتخاب دسته" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون دسته</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="brand_id" label="برند / سازنده">
            <Controller
              control={control}
              name="brand_id"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                >
                  <SelectTrigger id="brand_id" className="w-full">
                    <SelectValue placeholder="انتخاب برند" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون برند</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="country_of_origin" label="کشور سازنده" error={errors.country_of_origin?.message}>
            <Input id="country_of_origin" placeholder="اسکاتلند" {...register("country_of_origin")} />
          </Field>
          <Field id="description" label="توضیحات" error={errors.description?.message} full>
            <Textarea id="description" rows={4} {...register("description")} />
          </Field>
          {mode === "edit" ? (
            <div className="flex items-center justify-between sm:col-span-2">
              <div>
                <Label htmlFor="is_active">وضعیت انتشار</Label>
                <p className="text-xs text-muted-foreground">محصولات غیرفعال در فروشگاه دیده نمی‌شوند.</p>
              </div>
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    id="is_active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="وضعیت انتشار محصول"
                  />
                )}
              />
            </div>
          ) : null}
        </Section>

        <Section title="مشخصات">
          <Field id="abv" label="درصد الکل" error={errors.abv?.message}>
            <Input id="abv" type="number" step="0.1" dir="ltr" {...register("abv")} />
          </Field>
          <Field id="weight" label="وزن (گرم)" error={errors.weight?.message}>
            <Input id="weight" type="number" dir="ltr" {...register("weight")} />
          </Field>
        </Section>

        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5 sm:p-6">
          <legend className="px-1 font-serif text-lg">قیمت‌گذاری و تنوع‌ها</legend>
          <p className="mt-2 text-xs text-muted-foreground">
            هر محصول می‌تواند چند تنوع (مثلاً حجم‌های مختلف) با قیمت جداگانه داشته باشد.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {fields.length === 0 ? (
              <p className="rounded-xl bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
                هنوز تنوعی اضافه نشده است.
              </p>
            ) : null}
            {fields.map((f, i) => (
              <div
                key={f.id}
                className="grid items-end gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`variants.${i}.sku`} className="text-xs">
                    SKU
                  </Label>
                  <Input id={`variants.${i}.sku`} dir="ltr" {...register(`variants.${i}.sku`)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`variants.${i}.price`} className="text-xs">
                    قیمت (تومان)
                  </Label>
                  <Input
                    id={`variants.${i}.price`}
                    type="number"
                    dir="ltr"
                    aria-invalid={!!errors.variants?.[i]?.price}
                    {...register(`variants.${i}.price`)}
                  />
                  {errors.variants?.[i]?.price ? (
                    <p className="text-xs text-destructive">{errors.variants[i]?.price?.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`variants.${i}.compare_at_price`} className="text-xs">
                    قیمت پیش از تخفیف
                  </Label>
                  <Input
                    id={`variants.${i}.compare_at_price`}
                    type="number"
                    dir="ltr"
                    {...register(`variants.${i}.compare_at_price`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="حذف تنوع"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => append({ sku: "", price: "", compare_at_price: "" })}
            >
              <Plus className="size-4" /> افزودن تنوع
            </Button>
          </div>
        </fieldset>

        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5 sm:p-6">
          <legend className="px-1 font-serif text-lg">تصاویر محصول</legend>
          {mode === "create" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              تصاویر پس از ذخیرهٔ محصول بارگذاری می‌شوند.
            </p>
          ) : null}
          <div className="mt-4">
            <ImageUploader ref={uploaderRef} productId={mode === "edit" ? product?.id : null} />
          </div>
        </fieldset>

        <Section title="سئو و متادیتا">
          <Field id="meta_title" label="عنوان سئو" error={errors.meta_title?.message} full>
            <Input id="meta_title" {...register("meta_title")} />
          </Field>
          <Field id="meta_description" label="توضیحات سئو" error={errors.meta_description?.message} full>
            <Textarea id="meta_description" rows={2} {...register("meta_description")} />
          </Field>
          <Field id="meta_tags" label="کلیدواژه‌ها (با کاما جدا کنید)" full>
            <Input id="meta_tags" placeholder="ویسکی، تک‌مالت، اسکاتلند" {...register("meta_tags")} />
          </Field>
          {tags.length > 0 ? (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>برچسب‌ها</Label>
              <Controller
                control={control}
                name="tag_ids"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const active = field.value.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            field.onChange(
                              active
                                ? field.value.filter((id) => id !== t.id)
                                : [...field.value, t.id]
                            )
                          }
                          className={cn(
                            "min-h-9 rounded-full border px-3 text-sm transition-colors",
                            "focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {t.title}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </div>
          ) : null}
        </Section>
      </div>

      <aside className="flex flex-col gap-6">
        <div className="border-hairline rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/5">
          <p className="mb-4 text-sm text-muted-foreground">پیش‌نمایش</p>
          <span className="relative mx-auto flex aspect-[4/5] w-32 items-end justify-center overflow-hidden rounded-xl bg-muted">
            <OptimizedImage
              src={primaryImage?.image_url}
              alt={title || "تصویر محصول"}
              width={256}
              className="h-full w-full"
            />
          </span>
          <p className="mt-4 font-medium">{title || "نام محصول"}</p>
          <p className="text-xs text-muted-foreground">{brandName ?? "برند"}</p>
        </div>

        <div className="flex flex-col gap-2 lg:sticky lg:top-6">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting}
            onClick={() => router.push("/admin/products")}
          >
            انصراف
          </Button>
        </div>
      </aside>
    </form>
  )
}
