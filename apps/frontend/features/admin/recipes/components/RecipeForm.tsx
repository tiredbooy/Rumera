"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  Sparkles,
  ListChecks,
  ShoppingCart,
  FileText,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import type { Tag } from "@/features/catalog/tags/types"
import { difficultyFa } from "@/features/recipes/utils"
import {
  createRecipe,
  RecipeApiError,
  updateRecipe,
} from "@/features/recipes/api/client"
import type {
  AdminRecipeDetail,
  CreateRecipeInput,
  RecipeDifficulty,
  RecipeIngredientInput,
  RecipeProductInput,
  RecipeStatus,
} from "@/features/recipes/types"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { OptimizedImage } from "@/components/admin/optimized-image"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { VariantPicker, type VariantOption } from "@/components/admin/variant-picker"
import { FlexibleImageInput } from "@/components/admin/flexible-image-input"

// ── Validation ──────────────────────────────────────────────────────────────
// Numeric fields are kept as strings in the form and coerced on submit, matching
// product-form.tsx. Empty strings round-trip to the API's optional/zero values.

const intish = (msg: string, opts: { min?: number } = {}) =>
  z.string().refine(
    (v) => {
      if (v.trim() === "") return true
      const n = Number(v)
      return Number.isInteger(n) && (opts.min === undefined || n >= opts.min)
    },
    { message: msg }
  )

const ingredientSchema = z.object({
  ingredient_name: z.string().trim().min(1, "نام ماده الزامی است").max(255, "حداکثر ۲۵۵ نویسه"),
  quantity: z.string().trim().max(50),
  unit: z.string().trim().max(50),
  notes: z.string().trim().max(255),
  optional: z.boolean(),
  product_variant_id: z.number().nullable(),
})

const productSchema = z.object({
  product_variant_id: z
    .number({ message: "یک فرآورده انتخاب کنید" })
    .int()
    .min(1, "یک فرآورده انتخاب کنید"),
  // Carried for the picker label only (not sent to the API).
  _label: z.string().optional(),
  _brand: z.string().nullable().optional(),
  _sku: z.string().nullable().optional(),
  quantity: z.string().trim().max(50),
  unit: z.string().trim().max(50),
  is_primary: z.boolean(),
})

const schema = z.object({
  title: z.string().trim().min(1, "عنوان دستور الزامی است").max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z.string().trim().max(255),
  excerpt: z.string().trim().max(500),
  content: z.string().refine((v) => v.trim() !== "" && v !== "<p></p>", {
    message: "محتوای دستور الزامی است",
  }),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prep_time_minutes: intish("عدد صحیح وارد کنید", { min: 0 }),
  cook_time_minutes: intish("عدد صحیح وارد کنید", { min: 0 }),
  servings: intish("حداقل ۱", { min: 1 }),
  status: z.enum(["draft", "published", "archived"]),
  image_url: z.string().trim().max(500),
  is_featured: z.boolean(),
  meta_title: z.string().trim().max(255),
  meta_description: z.string().trim().max(500),
  tag_ids: z.array(z.number()),
  ingredients: z.array(ingredientSchema),
  products: z.array(productSchema),
})

type FormValues = z.infer<typeof schema>

const difficultyOptions: RecipeDifficulty[] = ["easy", "medium", "hard"]
const statusFa: Record<RecipeStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "بایگانی‌شده",
}

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null)
const intOrZero = (v?: string) => (v && v.trim() !== "" ? Number(v) : 0)

function defaults(recipe?: AdminRecipeDetail): FormValues {
  return {
    title: recipe?.title ?? "",
    slug: recipe?.slug ?? "",
    excerpt: recipe?.excerpt ?? "",
    content: recipe?.content ?? "",
    difficulty: recipe?.difficulty ?? "easy",
    prep_time_minutes: recipe?.prep_time_minutes ? String(recipe.prep_time_minutes) : "",
    cook_time_minutes: recipe?.cook_time_minutes ? String(recipe.cook_time_minutes) : "",
    servings: recipe?.servings ? String(recipe.servings) : "",
    status: recipe?.status ?? "draft",
    image_url: recipe?.image_url ?? "",
    is_featured: recipe?.is_featured ?? false,
    meta_title: recipe?.meta_title ?? "",
    meta_description: recipe?.meta_description ?? "",
    tag_ids: (recipe?.tags ?? []).map((t) => t.id),
    ingredients: (recipe?.ingredients ?? []).map((i) => ({
      ingredient_name: i.ingredient_name,
      quantity: i.quantity ?? "",
      unit: i.unit ?? "",
      notes: i.notes ?? "",
      optional: i.optional,
      product_variant_id: i.product_variant_id,
    })),
    products: (recipe?.products ?? []).map((p) => ({
      product_variant_id: p.product_variant_id,
      _label: p.product_title,
      _brand: p.brand ?? null,
      _sku: p.sku ?? null,
      quantity: p.quantity ?? "",
      unit: p.unit ?? "",
      is_primary: p.is_primary,
    })),
  }
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: typeof Sparkles
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <header className="mb-4">
        <h2 className="eyebrow">
          <Icon className="size-3.5" aria-hidden />
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>
    </section>
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
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ── Nested builders ────────────────────────────────────────────────────────────

function IngredientsBuilder({
  control,
  register,
  errors,
}: {
  control: Control<FormValues>
  register: ReturnType<typeof useForm<FormValues>>["register"]
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"]
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "ingredients" })

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          هنوز ماده‌ای اضافه نشده است.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((f, i) => (
            <li
              key={f.id}
              className="grid items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border sm:grid-cols-[auto_1fr_1fr]"
            >
              <div className="flex items-center gap-1 self-center sm:flex-col sm:self-start sm:pt-7">
                <span className="text-muted-foreground" aria-hidden>
                  <GripVertical className="size-4" />
                </span>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 sm:grid sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`ingredients.${i}.ingredient_name`} className="text-xs">
                    نام ماده
                  </Label>
                  <Input
                    id={`ingredients.${i}.ingredient_name`}
                    aria-invalid={!!errors.ingredients?.[i]?.ingredient_name}
                    {...register(`ingredients.${i}.ingredient_name`)}
                  />
                  {errors.ingredients?.[i]?.ingredient_name ? (
                    <p className="text-xs text-destructive">
                      {errors.ingredients[i]?.ingredient_name?.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`ingredients.${i}.quantity`} className="text-xs">
                    مقدار
                  </Label>
                  <Input
                    id={`ingredients.${i}.quantity`}
                    dir="ltr"
                    placeholder="۶۰"
                    {...register(`ingredients.${i}.quantity`)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`ingredients.${i}.unit`} className="text-xs">
                    واحد
                  </Label>
                  <Input
                    id={`ingredients.${i}.unit`}
                    placeholder="میلی‌لیتر"
                    {...register(`ingredients.${i}.unit`)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`ingredients.${i}.notes`} className="text-xs">
                    یادداشت (اختیاری)
                  </Label>
                  <Input
                    id={`ingredients.${i}.notes`}
                    placeholder="مثلاً تازه فشرده"
                    {...register(`ingredients.${i}.notes`)}
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Controller
                    control={control}
                    name={`ingredients.${i}.optional`}
                    render={({ field }) => (
                      <Switch
                        id={`ingredients.${i}.optional`}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="ماده اختیاری است"
                      />
                    )}
                  />
                  <Label htmlFor={`ingredients.${i}.optional`} className="text-xs font-normal">
                    اختیاری
                  </Label>
                  <div className="ms-auto flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="انتقال به بالا"
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="انتقال به پایین"
                      disabled={i === fields.length - 1}
                      onClick={() => move(i, i + 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`حذف ماده ${faNum(i + 1)}`}
                      onClick={() => remove(i)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          append({
            ingredient_name: "",
            quantity: "",
            unit: "",
            notes: "",
            optional: false,
            product_variant_id: null,
          })
        }
      >
        <Plus className="size-4" /> افزودن ماده
      </Button>
    </div>
  )
}

function ShoppableBuilder({
  control,
  register,
  errors,
  setValue,
}: {
  control: Control<FormValues>
  register: ReturnType<typeof useForm<FormValues>>["register"]
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"]
  setValue: ReturnType<typeof useForm<FormValues>>["setValue"]
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "products" })

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          محصول فروختنی‌ای به این دستور پیوند داده نشده است.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((f, i) => (
            <li
              key={f.id}
              className="grid items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border"
            >
              <div className="flex flex-col gap-1.5">
                <Label id={`products.${i}.label`} className="text-xs">
                  فرآورده فروختنی
                </Label>
                <Controller
                  control={control}
                  name={`products.${i}.product_variant_id`}
                  render={({ field }) => (
                    <VariantPicker
                      value={field.value || null}
                      ariaLabelledBy={`products.${i}.label`}
                      invalid={!!errors.products?.[i]?.product_variant_id}
                      initialLabel={
                        f._label
                          ? {
                              variantId: f.product_variant_id,
                              productTitle: f._label,
                              brand: f._brand ?? null,
                              sku: f._sku ?? null,
                              price: 0,
                            }
                          : null
                      }
                      onChange={(opt: VariantOption | null) => {
                        field.onChange(opt?.variantId ?? 0)
                        setValue(`products.${i}._label`, opt?.productTitle ?? "")
                        setValue(`products.${i}._brand`, opt?.brand ?? null)
                        setValue(`products.${i}._sku`, opt?.sku ?? null)
                      }}
                    />
                  )}
                />
                {errors.products?.[i]?.product_variant_id ? (
                  <p className="text-xs text-destructive">
                    {errors.products[i]?.product_variant_id?.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`products.${i}.quantity`} className="text-xs">
                    مقدار
                  </Label>
                  <Input
                    id={`products.${i}.quantity`}
                    dir="ltr"
                    placeholder="۱"
                    {...register(`products.${i}.quantity`)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`products.${i}.unit`} className="text-xs">
                    واحد
                  </Label>
                  <Input
                    id={`products.${i}.unit`}
                    placeholder="بطری"
                    {...register(`products.${i}.unit`)}
                  />
                </div>
                <div className="flex items-end gap-3 pb-0.5">
                  <div className="flex items-center gap-2">
                    <Controller
                      control={control}
                      name={`products.${i}.is_primary`}
                      render={({ field }) => (
                        <Switch
                          id={`products.${i}.is_primary`}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="فرآورده اصلی"
                        />
                      )}
                    />
                    <Label htmlFor={`products.${i}.is_primary`} className="text-xs font-normal">
                      اصلی
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`حذف فرآورده ${faNum(i + 1)}`}
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          append({
            product_variant_id: 0,
            _label: "",
            _brand: null,
            _sku: null,
            quantity: "",
            unit: "",
            is_primary: false,
          })
        }
      >
        <Plus className="size-4" /> پیوند فرآورده فروختنی
      </Button>
    </div>
  )
}

// ── Form ────────────────────────────────────────────────────────────────────

export function RecipeForm({
  mode,
  recipe,
  tags,
  submitLabel = "ذخیره",
}: {
  mode: "create" | "edit"
  recipe?: AdminRecipeDetail
  tags: Tag[]
  submitLabel?: string
}) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(recipe),
  })

  const title = watch("title")
  const imageUrl = watch("image_url")
  const status = watch("status")

  /** Map the (string-keyed, form-shaped) values onto the API payload. */
  function toPayload(v: FormValues): CreateRecipeInput {
    const ingredients: RecipeIngredientInput[] = v.ingredients.map((ing, idx) => ({
      ingredient_name: ing.ingredient_name.trim(),
      quantity: strOrNull(ing.quantity),
      unit: strOrNull(ing.unit),
      notes: strOrNull(ing.notes),
      optional: ing.optional,
      product_variant_id: ing.product_variant_id,
      sort_order: idx,
    }))
    const products: RecipeProductInput[] = v.products.map((p, idx) => ({
      product_variant_id: p.product_variant_id,
      quantity: strOrNull(p.quantity),
      unit: strOrNull(p.unit),
      is_primary: p.is_primary,
      sort_order: idx,
    }))
    return {
      title: v.title.trim(),
      slug: strOrNull(v.slug),
      excerpt: strOrNull(v.excerpt),
      content: v.content,
      difficulty: v.difficulty,
      prep_time_minutes: intOrZero(v.prep_time_minutes),
      cook_time_minutes: intOrZero(v.cook_time_minutes),
      servings: intOrZero(v.servings) || undefined,
      status: v.status,
      image_url: strOrNull(v.image_url),
      is_featured: v.is_featured,
      meta_title: strOrNull(v.meta_title),
      meta_description: strOrNull(v.meta_description),
      tag_ids: v.tag_ids,
      ingredients,
      products,
    }
  }

  function applyServerErrors(e: unknown) {
    if (e instanceof RecipeApiError) {
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
      const payload = toPayload(v)
      if (mode === "create") {
        await createRecipe(payload)
        toast.success("دستور ایجاد شد")
      } else if (recipe) {
        await updateRecipe(recipe.id, payload)
        toast.success("تغییرات ذخیره شد")
      }
      router.push("/admin/recipes")
      router.refresh()
    } catch (e) {
      applyServerErrors(e)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      noValidate
    >
      <div className="flex flex-col gap-6">
        <Section icon={Sparkles} title="اطلاعات کلی" description="عنوان و معرفی کوتاه دستور.">
          <Field id="title" label="عنوان دستور" error={errors.title?.message} full>
            <Input
              id="title"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : undefined}
              {...register("title")}
            />
          </Field>
          <Field
            id="slug"
            label="نامک (انگلیسی)"
            error={errors.slug?.message}
            hint="خالی بگذارید تا از روی عنوان ساخته شود."
          >
            <Input id="slug" dir="ltr" placeholder="negroni-classico" {...register("slug")} />
          </Field>
          <Field id="excerpt" label="خلاصه" error={errors.excerpt?.message}>
            <Input id="excerpt" placeholder="یک کوکتل تلخ و کلاسیک ایتالیایی" {...register("excerpt")} />
          </Field>
        </Section>

        <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <header className="mb-4">
            <h2 className="eyebrow">
              <FileText className="size-3.5" aria-hidden />
              روش تهیه
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              مراحل آماده‌سازی را با قالب‌بندی غنی بنویسید.
            </p>
          </header>
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <RichTextEditor
                id="content"
                value={field.value}
                onChange={field.onChange}
                ariaInvalid={!!errors.content}
                ariaDescribedBy={errors.content ? "content-error" : undefined}
              />
            )}
          />
          {errors.content ? (
            <p id="content-error" className="mt-2 text-xs text-destructive">
              {errors.content.message}
            </p>
          ) : null}
        </section>

        <Section icon={Sparkles} title="مشخصات" description="دشواری و زمان‌بندی تهیه.">
          <Field id="difficulty" label="سطح دشواری">
            <Controller
              control={control}
              name="difficulty"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="difficulty" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {difficultyOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {difficultyFa[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="servings" label="تعداد سروینگ" error={errors.servings?.message}>
            <Input id="servings" type="number" dir="ltr" min={1} {...register("servings")} />
          </Field>
          <Field
            id="prep_time_minutes"
            label="زمان آماده‌سازی (دقیقه)"
            error={errors.prep_time_minutes?.message}
          >
            <Input
              id="prep_time_minutes"
              type="number"
              dir="ltr"
              min={0}
              {...register("prep_time_minutes")}
            />
          </Field>
          <Field
            id="cook_time_minutes"
            label="زمان پخت (دقیقه)"
            error={errors.cook_time_minutes?.message}
          >
            <Input
              id="cook_time_minutes"
              type="number"
              dir="ltr"
              min={0}
              {...register("cook_time_minutes")}
            />
          </Field>
        </Section>

        <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <header className="mb-4">
            <h2 className="eyebrow">
              <ListChecks className="size-3.5" aria-hidden />
              مواد لازم
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              هر ماده را با مقدار و واحد آن فهرست کنید. ترتیب نمایش با جابه‌جایی ردیف‌ها تغییر می‌کند.
            </p>
          </header>
          <IngredientsBuilder control={control} register={register} errors={errors} />
        </section>

        <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <header className="mb-4">
            <h2 className="eyebrow">
              <ShoppingCart className="size-3.5" aria-hidden />
              فرآورده‌های فروختنی
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              فرآورده‌هایی از کاتالوگ که خواننده می‌تواند مستقیم از صفحهٔ دستور به سبد بیفزاید.
            </p>
          </header>
          <ShoppableBuilder
            control={control}
            register={register}
            errors={errors}
            setValue={setValue}
          />
        </section>

        <Accordion type="single" collapsible className="bg-card ring-1 ring-foreground/[0.04]">
          <AccordionItem value="seo">
            <AccordionTrigger>
              <span className="eyebrow">
                <Sparkles className="size-3.5" aria-hidden />
                سئو و متادیتا
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="meta_title" label="عنوان سئو" error={errors.meta_title?.message} full>
                  <Input id="meta_title" {...register("meta_title")} />
                </Field>
                <Field
                  id="meta_description"
                  label="توضیحات سئو"
                  error={errors.meta_description?.message}
                  full
                >
                  <Textarea id="meta_description" rows={2} {...register("meta_description")} />
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <aside className="flex flex-col gap-6">
        <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
          <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
            <h2 className="eyebrow mb-3">
              <ImageIcon className="size-3.5" aria-hidden />
              تصویر شاخص
            </h2>
            <span className="relative mb-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/[0.04]">
              <OptimizedImage
                src={imageUrl || null}
                alt={title || "تصویر دستور"}
                width={480}
                className="h-full w-full"
              />
            </span>
            <Label htmlFor="image_url" className="sr-only">
              نشانی تصویر
            </Label>
            <Controller
              control={control}
              name="image_url"
              render={({ field }) => (
                <FlexibleImageInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  folder="recipes"
                  placeholder="https://… یا بارگذاری فایل"
                  ariaInvalid={!!errors.image_url}
                  hidePreview
                />
              )}
            />
            {errors.image_url ? (
              <p className="mt-1.5 text-xs text-destructive">{errors.image_url.message}</p>
            ) : null}
          </div>

          <div className="border-hairline flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
            <Field id="status" label="وضعیت انتشار">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusFa) as RecipeStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusFa[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="is_featured">دستور ویژه</Label>
                <p className="text-xs text-muted-foreground">در بخش‌های منتخب سایت نمایش داده می‌شود.</p>
              </div>
              <Controller
                control={control}
                name="is_featured"
                render={({ field }) => (
                  <Switch
                    id="is_featured"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="دستور ویژه"
                  />
                )}
              />
            </div>
          </div>

          {tags.length > 0 ? (
            <div className="border-hairline flex flex-col gap-2.5 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
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
                            "min-h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors",
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

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              onClick={() => router.push("/admin/recipes")}
            >
              انصراف
            </Button>
            <p className="px-1 text-center text-xs text-muted-foreground">
              {status === "published"
                ? "این دستور پس از ذخیره منتشر می‌شود."
                : status === "archived"
                  ? "این دستور بایگانی و از سایت پنهان می‌شود."
                  : "این دستور به‌صورت پیش‌نویس ذخیره می‌شود."}
            </p>
          </div>
        </div>
      </aside>
    </form>
  )
}
