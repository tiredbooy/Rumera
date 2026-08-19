"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { toAsciiDigits } from "@/lib/normalize-digits";
import { cn } from "@/lib/utils";
import { validateImageURL } from "@/features/image-uploader/constants";
import type {
  Category,
  CategoryTree,
  CreateCategoryInput,
} from "@/features/catalog/categories/types";
import {
  CategoryApiError,
  createCategory,
  updateCategory,
} from "@/features/admin/categories/client";
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "@/features/catalog/categories/validations";
import { CATEGORIES_QUERY_KEY } from "@/lib/admin/category-keys";
import { CategoryImageInput } from "./category-image-input";

// ── Validation (all fields are strings; coerced to the API shape on submit) ────

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
const numOrNull = (v?: string) => {
  if (!v) return null;
  const n = toAsciiDigits(v).trim();
  return n !== "" ? Number(n) : null;
};

/** Normalize a label into the same Unicode-safe path segment as the backend. */
function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaults(category?: Category): CategoryFormValues {
  return {
    title: category?.title ?? "",
    slug: category?.slug ?? "",
    parent_id: category?.parent_id ? String(category.parent_id) : "",
    description: category?.description ?? "",
    image_url: category?.image_url ?? "",
    is_featured: category?.is_featured ?? false,
    card_size: category?.card_size ?? "small",
    display_order:
      category?.display_order != null ? String(category.display_order) : "0",
  };
}

/**
 * Flattens the category tree into indented options for the parent picker,
 * excluding `excludeId` and all of its descendants (a category can never be its
 * own ancestor — that would create a cycle).
 */
type ParentOption = { id: number; label: string; depth: number };

function flattenForPicker(
  nodes: CategoryTree[],
  excludeId?: number,
  depth = 0,
  out: ParentOption[] = [],
): ParentOption[] {
  // The tree comes from the network; guard against a null/undefined or
  // non-array payload (e.g. an empty `{ data: null }` envelope) so the picker
  // degrades to "no parents" instead of throwing "nodes is not iterable".
  if (!Array.isArray(nodes)) return out;
  for (const node of nodes) {
    if (node.id === excludeId) continue; // skips the node AND (by not recursing) its subtree
    out.push({ id: node.id, label: node.title, depth });
    if (node.children?.length)
      flattenForPicker(node.children, excludeId, depth + 1, out);
  }
  return out;
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactElement;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <FieldControl id={id} error={error} description={Boolean(hint && !error)}>
        {children as React.ReactElement}
      </FieldControl>
      {hint && !error ? (
        <p
          id={fieldDescriptionId(id)}
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={fieldErrorId(id)}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CategoryForm({
  mode,
  category,
  tree,
  submitLabel = "ذخیره",
  canWrite = true,
}: {
  mode: "create" | "edit";
  category?: Category;
  tree: CategoryTree[];
  submitLabel?: string;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Tracks whether the user has hand-edited the slug, so auto-suggest stops
  // clobbering their input once they take over.
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [imageUploading, setImageUploading] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaults(category),
  });

  const title = watch("title");
  const slug = watch("slug");
  const imageUrl = watch("image_url");
  const previewImageUrl = validateImageURL(imageUrl, {
    allowEmpty: true,
    allowMediaPath: true,
  })
    ? ""
    : imageUrl;
  const isFeatured = watch("is_featured");
  const cardSize = watch("card_size");

  // Auto-suggest the slug from the title until the user edits the slug directly.
  React.useEffect(() => {
    if (!slugTouched) {
      const suggestion = toSlug(title);
      if (suggestion) setValue("slug", suggestion, { shouldValidate: false });
    }
  }, [title, slugTouched, setValue]);

  const parentOptions = React.useMemo(
    () => flattenForPicker(tree, category?.id),
    [tree, category?.id],
  );

  function applyServerErrors(e: unknown) {
    if (e instanceof CategoryApiError) {
      if (e.fields) {
        Object.entries(e.fields).forEach(([key, msgs], index) => {
          setError(
            key as keyof CategoryFormValues,
            { message: msgs[0] },
            { shouldFocus: index === 0 },
          );
        });
      }
      toast.error(e.message);
    } else {
      toast.error("خطای غیرمنتظره رخ داد");
    }
  }

  function toPayload(v: CategoryFormValues): CreateCategoryInput {
    return {
      title: v.title.trim(),
      slug: strOrNull(v.slug),
      parent_id: numOrNull(v.parent_id),
      description: strOrNull(v.description),
      image_url: strOrNull(v.image_url),
      is_featured: v.is_featured,
      card_size: v.card_size,
      display_order: numOrNull(v.display_order) ?? 0,
    };
  }

  async function onSubmit(v: CategoryFormValues) {
    if (!canWrite) return;
    try {
      if (mode === "create") {
        await createCategory(toPayload(v));
        toast.success("دسته‌بندی ایجاد شد");
      } else if (category) {
        await updateCategory(category.id, toPayload(v));
        toast.success("تغییرات ذخیره شد");
      }
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      guard.release();
      router.push("/admin/categories");
      router.refresh();
    } catch (e) {
      applyServerErrors(e);
    }
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!canWrite) {
      event.preventDefault();
      return;
    }
    void handleSubmit(onSubmit)(event);
  }

  const editorLocked = isSubmitting || imageUploading || !canWrite;
  const guard = useUnsavedChangesGuard({
    enabled: isDirty,
    isSaving: isSubmitting,
  });

  return (
    <form
      onSubmit={onFormSubmit}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      {canWrite ? null : (
        <p
          role="status"
          className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/60 lg:col-span-2"
        >
          فقط مشاهده — ذخیره و بارگذاری تصویر به مجوز نوشتن محصول نیاز دارد.
        </p>
      )}
      <fieldset disabled={editorLocked} className="contents">
      <div className="flex flex-col gap-6">
        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <legend className="px-1 font-serif text-base">
            اطلاعات دسته‌بندی
          </legend>
          <p className="-mt-0.5 text-xs text-muted-foreground">
            دسته‌بندی‌ها ساختار درختی دارند؛ می‌توانید یک دستهٔ والد انتخاب
            کنید.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                id="title"
                label="نام دسته‌بندی"
                error={errors.title?.message}
              >
                <Input
                  id="title"
                  data-testid="category-title"
                  aria-invalid={!!errors.title}
                  disabled={!canWrite}
                  {...register("title")}
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
                disabled={!canWrite}
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
                    onValueChange={(val) =>
                      field.onChange(val === "none" ? "" : val)
                    }
                    disabled={!canWrite}
                  >
                    <SelectTrigger
                      id="parent_id"
                      className="w-full"
                      data-testid="category-parent"
                    >
                      <SelectValue placeholder="انتخاب دستهٔ والد" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        بدون والد (دستهٔ اصلی)
                      </SelectItem>
                      {parentOptions.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          <span
                            style={{
                              paddingInlineStart: `${opt.depth * 0.85}rem`,
                            }}
                          >
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
              <Field
                id="description"
                label="توضیحات"
                error={errors.description?.message}
              >
                <Textarea
                  id="description"
                  rows={3}
                  disabled={!canWrite}
                  {...register("description")}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field
                id="image_url"
                label="تصویر دسته‌بندی"
                error={errors.image_url?.message}
              >
                <Controller
                  control={control}
                  name="image_url"
                  render={({ field }) => (
                    <CategoryImageInput
                      id="image_url"
                      name={field.name}
                      urlInputRef={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      onUploadingChange={setImageUploading}
                      error={errors.image_url?.message}
                      disabled={!canWrite}
                    />
                  )}
                />
              </Field>
            </div>
          </div>
        </fieldset>

        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <legend className="px-1 font-serif text-base">
            نمایش در صفحهٔ اصلی
          </legend>
          <p className="-mt-0.5 text-xs text-muted-foreground">
            دسته‌بندی‌های ویژه در صفحهٔ اصلی، در قالب یک کارت بزرگ و چند کارت
            کوچک نمایش داده می‌شوند.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="is_featured" className="flex flex-col gap-0.5">
                <span>نمایش در صفحهٔ اصلی</span>
                <span className="text-xs font-normal text-muted-foreground">
                  این دسته‌بندی به‌عنوان یکی از دسته‌های ویژه نمایش داده شود.
                </span>
              </Label>
              <Controller
                control={control}
                name="is_featured"
                render={({ field }) => (
                  <Switch
                    id="is_featured"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="category-is-featured"
                    disabled={!canWrite}
                  />
                )}
              />
            </div>

            {isFeatured ? (
              <div className="grid gap-4 border-t border-dashed pt-4 sm:grid-cols-2">
                <Field id="card_size" label="اندازهٔ کارت">
                  <Controller
                    control={control}
                    name="card_size"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!canWrite}
                      >
                        <SelectTrigger
                          id="card_size"
                          className="w-full"
                          data-testid="category-card-size"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="large">بزرگ</SelectItem>
                          <SelectItem value="small">کوچک</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field
                  id="display_order"
                  label="ترتیب نمایش"
                  error={errors.display_order?.message}
                  hint="عدد کوچک‌تر زودتر نمایش داده می‌شود."
                >
                  <Input
                    id="display_order"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    aria-invalid={!!errors.display_order}
                    disabled={!canWrite}
                    {...register("display_order")}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </fieldset>
      </div>
      </fieldset>

      <aside className="flex flex-col gap-6">
        <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
          <div className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/[0.04]">
            <p className="mb-4 text-xs font-medium text-muted-foreground">
              پیش‌نمایش
            </p>
            <div
              className={cn(
                "overflow-hidden rounded-xl bg-muted/40 ring-1 ring-foreground/[0.04]",
                cardSize === "large" ? "aspect-[4/3]" : "aspect-[16/10]",
              )}
            >
              {previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
            </div>
            <p className="mt-3 font-serif text-lg">
              {title || "نام دسته‌بندی"}
            </p>
            {slug ? (
              <p
                dir="ltr"
                className="mt-1 text-start text-xs text-muted-foreground"
              >
                /{slug}
              </p>
            ) : null}
            {isFeatured ? (
              <p className="mt-2 text-xs text-muted-foreground">
                کارت {cardSize === "large" ? "بزرگ" : "کوچک"} · صفحهٔ اصلی
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {canWrite ? (
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || imageUploading}
                data-testid="category-submit"
              >
                {isSubmitting || imageUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {submitLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting || imageUploading}
              onClick={() => guard.requestNavigation("/admin/categories")}
            >
              انصراف
            </Button>
          </div>
        </div>
      </aside>

      <UnsavedChangesDialog {...guard.dialogProps} />
    </form>
  );
}
