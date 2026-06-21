"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category } from "@/lib/catalog/types"
import {
  AdminApiError,
  createCategory,
  updateCategory,
  type CategoryTreeNode,
  type CreateCategoryInput,
} from "@/lib/api/admin-client"
import { CATEGORIES_QUERY_KEY } from "@/lib/admin/category-keys"

// The shoppable image is part of this screen's spec but not yet on the shared
// category contract; widen the input/category locally so the form typechecks
// without touching the shared api-client/types modules.
type CategoryInput = CreateCategoryInput & { image_url?: string | null }
type CategoryWithImage = Category & { image_url?: string | null }

// ── Validation (all fields are strings; coerced to the API shape on submit) ────

const schema = z.object({
  name: z.string().trim().min(1, "نام دسته‌بندی الزامی است").max(255, "حداکثر ۲۵۵ نویسه"),
  slug: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  parent_id: z.string(),
  description: z.string(),
  image_url: z.string().trim(),
})

type FormValues = z.infer<typeof schema>

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null)
const numOrNull = (v?: string) => (v && v.trim() !== "" ? Number(v) : null)

/** Latinise a label into a URL-safe slug; Persian text falls back to empty. */
function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‌\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function defaults(category?: CategoryWithImage): FormValues {
  return {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    parent_id: category?.parent_id ? String(category.parent_id) : "",
    description: category?.description ?? "",
    image_url: category?.image_url ?? "",
  }
}

/**
 * Flattens the category tree into indented options for the parent picker,
 * excluding `excludeId` and all of its descendants (a category can never be its
 * own ancestor — that would create a cycle).
 */
type ParentOption = { id: number; label: string; depth: number }

function flattenForPicker(
  nodes: CategoryTreeNode[],
  excludeId?: number,
  depth = 0,
  out: ParentOption[] = []
): ParentOption[] {
  // The tree comes from the network; guard against a null/undefined or
  // non-array payload (e.g. an empty `{ data: null }` envelope) so the picker
  // degrades to "no parents" instead of throwing "nodes is not iterable".
  if (!Array.isArray(nodes)) return out
  for (const node of nodes) {
    if (node.id === excludeId) continue // skips the node AND (by not recursing) its subtree
    out.push({ id: node.id, label: node.name, depth })
    if (node.children?.length) flattenForPicker(node.children, excludeId, depth + 1, out)
  }
  return out
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function CategoryForm({
  mode,
  category,
  tree,
  submitLabel = "ذخیره",
}: {
  mode: "create" | "edit"
  category?: CategoryWithImage
  tree: CategoryTreeNode[]
  submitLabel?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  // Tracks whether the user has hand-edited the slug, so auto-suggest stops
  // clobbering their input once they take over.
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit")

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
    defaultValues: defaults(category),
  })

  const name = watch("name")
  const slug = watch("slug")

  // Auto-suggest the slug from the name until the user edits the slug directly.
  React.useEffect(() => {
    if (!slugTouched) {
      const suggestion = toSlug(name)
      if (suggestion) setValue("slug", suggestion, { shouldValidate: false })
    }
  }, [name, slugTouched, setValue])

  const parentOptions = React.useMemo(
    () => flattenForPicker(tree, category?.id),
    [tree, category?.id]
  )

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

  function toPayload(v: FormValues): CategoryInput {
    return {
      name: v.name.trim(),
      slug: strOrNull(v.slug),
      parent_id: numOrNull(v.parent_id),
      description: strOrNull(v.description),
      // image_url is part of the UI spec; the backend ignores unknown JSON keys,
      // so it is safe to send and forward-compatible once persistence lands.
      image_url: strOrNull(v.image_url),
    }
  }

  async function onSubmit(v: FormValues) {
    try {
      if (mode === "create") {
        await createCategory(toPayload(v))
        toast.success("دسته‌بندی ایجاد شد")
      } else if (category) {
        await updateCategory(category.id, toPayload(v))
        toast.success("تغییرات ذخیره شد")
      }
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY })
      router.push("/admin/categories")
      router.refresh()
    } catch (e) {
      applyServerErrors(e)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <legend className="px-1 font-serif text-base">اطلاعات دسته‌بندی</legend>
          <p className="-mt-0.5 text-xs text-muted-foreground">
            دسته‌بندی‌ها ساختار درختی دارند؛ می‌توانید یک دستهٔ والد انتخاب کنید.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="name" label="نام دسته‌بندی" error={errors.name?.message}>
                <Input
                  id="name"
                  data-testid="category-name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
              </Field>
            </div>

            <Field
              id="slug"
              label="نامک (انگلیسی)"
              error={errors.slug?.message}
              hint="به‌صورت خودکار از نام پیشنهاد می‌شود؛ قابل ویرایش است."
            >
              <Input
                id="slug"
                dir="ltr"
                placeholder="single-malt"
                aria-invalid={!!errors.slug}
                {...register("slug", {
                  onChange: () => setSlugTouched(true),
                })}
              />
            </Field>

            <Field id="parent_id" label="دستهٔ والد">
              <Controller
                control={control}
                name="parent_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                  >
                    <SelectTrigger id="parent_id" className="w-full" data-testid="category-parent">
                      <SelectValue placeholder="انتخاب دستهٔ والد" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون والد (دستهٔ اصلی)</SelectItem>
                      {parentOptions.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          <span style={{ paddingInlineStart: `${opt.depth * 0.85}rem` }}>
                            {opt.depth > 0 ? "↳ " : ""}
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field id="description" label="توضیحات" error={errors.description?.message}>
                <Textarea id="description" rows={3} {...register("description")} />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field
                id="image_url"
                label="نشانی تصویر"
                error={errors.image_url?.message}
                hint="اختیاری — نشانی کامل تصویر شاخص دسته‌بندی."
              >
                <Input
                  id="image_url"
                  dir="ltr"
                  placeholder="https://…"
                  inputMode="url"
                  {...register("image_url")}
                />
              </Field>
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="flex flex-col gap-6">
        <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
          <div className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/[0.04]">
            <p className="mb-4 text-xs font-medium text-muted-foreground">پیش‌نمایش</p>
            <p className="font-serif text-lg">{name || "نام دسته‌بندی"}</p>
            {slug ? (
              <p dir="ltr" className="mt-1 text-start text-xs text-muted-foreground">
                /{slug}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={isSubmitting} data-testid="category-submit">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              onClick={() => router.push("/admin/categories")}
            >
              انصراف
            </Button>
          </div>
        </div>
      </aside>
    </form>
  )
}
