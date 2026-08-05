"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, ImageIcon, Loader2, SearchCheck } from "lucide-react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MultiTagPicker } from "@/features/admin/shared/multi-tag-picker";
import type { Tag } from "@/features/catalog/tags/types";
import { ImageInput } from "@/features/image-uploader/ImageInput";
import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import {
  createJournalPost,
  journalAdminKeys,
  JournalApiError,
  updateJournalPost,
} from "@/features/journal/api/client";
import type {
  JournalCategory,
  JournalDetail,
  JournalStatus,
} from "@/features/journal/types";
import {
  journalPostFormDefaults,
  journalPostFormSchema,
  normalizeJournalSlug,
  toCreateJournalPostInput,
  toUpdateJournalPostInput,
  type JournalPostFormValues,
} from "@/features/journal/validations";
import { faDate } from "@/lib/utils/date";

import { JournalFormField, JournalFormSection } from "./form-field";
import {
  JournalProductPicker,
  type JournalProductOption,
} from "./journal-product-picker";

const STATUS_LABELS: Record<JournalStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "بایگانی‌شده",
};

const FORM_FIELDS = new Set<keyof JournalPostFormValues>([
  "title",
  "slug",
  "excerpt",
  "content",
  "image_url",
  "image_alt",
  "time_to_read",
  "status",
  "is_featured",
  "meta_title",
  "meta_description",
  "category_ids",
  "product_ids",
  "tag_ids",
]);

function ChoiceList({
  label,
  empty,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  empty: string;
  options: { id: number; label: string }[];
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
}) {
  if (!options.length) {
    return <p className="text-xs leading-5 text-muted-foreground">{empty}</p>;
  }

  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = value.includes(option.id);
          const id = `${label}-${option.id}`;
          return (
            <label
              key={option.id}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-disabled:cursor-not-allowed has-disabled:opacity-60"
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(next) =>
                  onChange(
                    next
                      ? [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function JournalForm({
  mode,
  post,
  categories,
  tags,
  initialProducts,
}: {
  mode: "create" | "edit";
  post?: JournalDetail;
  categories: JournalCategory[];
  tags: Tag[];
  initialProducts: JournalProductOption[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mediaRef =
    React.useRef<ImageUploaderHandle<UploadedImage | null>>(null);
  const [previewURL, setPreviewURL] = React.useState(post?.image_url ?? "");
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JournalPostFormValues>({
    resolver: zodResolver(journalPostFormSchema),
    defaultValues: journalPostFormDefaults(post),
  });
  const title = useWatch({ control, name: "title" });
  const slug = useWatch({ control, name: "slug" });
  const imageAlt = useWatch({ control, name: "image_alt" });
  const status = useWatch({ control, name: "status" });

  React.useEffect(() => {
    if (slugTouched) return;
    setValue("slug", normalizeJournalSlug(title), { shouldValidate: false });
  }, [setValue, slugTouched, title]);

  function applyServerError(error: unknown) {
    if (error instanceof JournalApiError) {
      let focused = false;
      for (const [key, messages] of Object.entries(error.fields ?? {})) {
        if (!FORM_FIELDS.has(key as keyof JournalPostFormValues)) continue;
        setError(
          key as keyof JournalPostFormValues,
          { message: messages[0] },
          { shouldFocus: !focused },
        );
        focused = true;
      }
      setFormError(error.message);
      toast.error(error.message);
      return;
    }
    const message =
      error instanceof Error ? error.message : "ذخیرهٔ نوشته ناموفق بود";
    setFormError(message);
    toast.error(message);
  }

  async function onSubmit(values: JournalPostFormValues) {
    setFormError(null);
    if (mode === "edit" && !normalizeJournalSlug(values.slug)) {
      setError(
        "slug",
        { message: "نامک نوشته الزامی است" },
        { shouldFocus: true },
      );
      return;
    }
    const mediaError = mediaRef.current?.validate() ?? null;
    if (mediaError) {
      setError("image_url", { message: mediaError }, { shouldFocus: true });
      return;
    }
    if (mediaRef.current?.hasStaged && !values.image_alt.trim()) {
      setError(
        "image_alt",
        { message: "برای تصویر شاخص متن جایگزین بنویسید" },
        { shouldFocus: true },
      );
      return;
    }

    let savedOwnerID: number | null = null;
    let mediaAttached = false;
    try {
      const staged = mediaRef.current?.hasStaged ?? false;
      const payload =
        mode === "create"
          ? toCreateJournalPostInput(values)
          : toUpdateJournalPostInput(values);
      if (staged) {
        payload.image_url = mode === "create" ? null : undefined;
        payload.image_alt = undefined;
      }

      let saved: JournalDetail;
      if (mode === "edit") {
        if (!post) return;
        if (staged) {
          await mediaRef.current?.flush(post.id);
          mediaAttached = true;
        }
        saved = await updateJournalPost(post.id, payload);
      } else {
        const publishAfterUpload = values.status === "published" && staged;
        if (publishAfterUpload) payload.status = "draft";
        saved = await createJournalPost(payload);
        savedOwnerID = saved.id;
        if (staged) {
          await mediaRef.current?.flush(saved.id);
          mediaAttached = true;
        }
        if (publishAfterUpload) {
          saved = await updateJournalPost(saved.id, { status: "published" });
        }
      }

      queryClient.setQueryData(journalAdminKeys.detail(saved.id), saved);
      await queryClient.invalidateQueries({
        queryKey: journalAdminKeys.lists(),
        refetchType: "none",
      });

      toast.success(
        mode === "create" ? "نوشته ساخته شد" : "تغییرات نوشته ذخیره شد",
      );
      router.push("/admin/journal");
      router.refresh();
    } catch (error) {
      applyServerError(error);
      if (mediaAttached || savedOwnerID) {
        await queryClient.invalidateQueries({
          queryKey: journalAdminKeys.root,
          refetchType: "none",
        });
      }
      if (mode === "create" && savedOwnerID) {
        toast.info(
          mediaAttached
            ? "نوشته و تصویر ذخیره شدند؛ وضعیت انتشار را در صفحهٔ ویرایش بررسی کنید"
            : "نوشته ذخیره شد؛ بارگذاری تصویر را در صفحهٔ ویرایش ادامه دهید",
        );
        router.push(`/admin/journal/${savedOwnerID}`);
        router.refresh();
      } else if (mode === "edit" && mediaAttached) {
        toast.info("تصویر ذخیره شد؛ سایر تغییرات را دوباره ذخیره کنید");
      }
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      aria-busy={isSubmitting || undefined}
      className="grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      noValidate
    >
      <div className="flex min-w-0 flex-col gap-6">
        {formError ? (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
          >
            {formError}
          </p>
        ) : null}

        <JournalFormSection
          title="اطلاعات نوشته"
          description="عنوان و نامک، هویت نوشته را در ژورنال مشخص می‌کنند."
        >
          <JournalFormField
            id="title"
            label="عنوان"
            error={errors.title?.message}
            full
          >
            <Input
              id="title"
              autoComplete="off"
              disabled={isSubmitting}
              {...register("title")}
            />
          </JournalFormField>
          <JournalFormField
            id="slug"
            label="نامک"
            error={errors.slug?.message}
            hint={
              mode === "create"
                ? "در صورت خالی‌بودن، سرور یک نامک یکتا می‌سازد."
                : "تغییر نامک، نشانی عمومی نوشته را تغییر می‌دهد."
            }
            full
          >
            <Input
              id="slug"
              dir="auto"
              autoComplete="off"
              disabled={isSubmitting}
              value={slug}
              {...register("slug", { onChange: () => setSlugTouched(true) })}
            />
          </JournalFormField>
          <JournalFormField
            id="excerpt"
            label="خلاصه"
            error={errors.excerpt?.message}
            hint="در کارت‌ها و نتایج جستجو نمایش داده می‌شود."
            full
          >
            <Textarea
              id="excerpt"
              rows={4}
              disabled={isSubmitting}
              {...register("excerpt")}
            />
          </JournalFormField>
          <JournalFormField
            id="time_to_read"
            label="زمان مطالعه (دقیقه)"
            error={errors.time_to_read?.message}
          >
            <Input
              id="time_to_read"
              inputMode="numeric"
              dir="ltr"
              disabled={isSubmitting}
              {...register("time_to_read")}
            />
          </JournalFormField>
        </JournalFormSection>

        <section
          className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
          aria-labelledby="journal-content-title"
        >
          <header className="mb-4">
            <h2 id="journal-content-title" className="eyebrow">
              <FileText className="size-3.5" aria-hidden /> متن نوشته
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              محتوای اصلی را با سرتیترها، فهرست و پیوندهای معنادار بنویسید.
            </p>
          </header>
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <RichTextEditor
                id="content"
                inputRef={field.ref}
                disabled={isSubmitting}
                value={field.value}
                onChange={field.onChange}
                ariaLabel="محتوای نوشتهٔ ژورنال"
                ariaInvalid={!!errors.content}
                ariaDescribedBy={
                  errors.content ? fieldErrorId("content") : undefined
                }
                placeholder="متن نوشته را اینجا بنویسید…"
              />
            )}
          />
          {errors.content ? (
            <p
              id={fieldErrorId("content")}
              role="alert"
              className="mt-2 text-xs text-destructive"
            >
              {errors.content.message}
            </p>
          ) : null}
        </section>

        <JournalFormSection
          title="ارتباط‌ها"
          description="دسته‌ها، برچسب‌ها و محصولات مرتبط، کشف و خرید از دل محتوا را دقیق‌تر می‌کنند."
        >
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">دسته‌های ژورنال</p>
            <Controller
              control={control}
              name="category_ids"
              render={({ field }) => (
                <ChoiceList
                  label="دسته"
                  empty="هنوز دسته‌ای ساخته نشده است. از بخش دسته‌های ژورنال یک دسته بسازید."
                  options={categories.map((category) => ({
                    id: category.id,
                    label: category.name,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="tag_ids"
              render={({ field }) => (
                <MultiTagPicker
                  options={tags.map((tag) => ({
                    id: tag.id,
                    title: tag.title,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  emptyLabel="برچسبی برای انتخاب در دسترس نیست."
                />
              )}
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">محصولات مرتبط</p>
            <Controller
              control={control}
              name="product_ids"
              render={({ field }) => (
                <JournalProductPicker
                  value={field.value}
                  initialOptions={initialProducts}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
        </JournalFormSection>

        <JournalFormSection
          title="سئو"
          description="عنوان و توضیح اختصاصی موتور جستجو اختیاری است؛ در صورت خالی‌بودن از محتوای نوشته استفاده می‌شود."
        >
          <JournalFormField
            id="meta_title"
            label="عنوان سئو"
            error={errors.meta_title?.message}
            full
          >
            <Input
              id="meta_title"
              disabled={isSubmitting}
              {...register("meta_title")}
            />
          </JournalFormField>
          <JournalFormField
            id="meta_description"
            label="توضیح سئو"
            error={errors.meta_description?.message}
            full
          >
            <Textarea
              id="meta_description"
              rows={4}
              disabled={isSubmitting}
              {...register("meta_description")}
            />
          </JournalFormField>
        </JournalFormSection>
      </div>

      <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <h2 className="eyebrow mb-3">
            <ImageIcon className="size-3.5" aria-hidden /> تصویر شاخص
          </h2>
          <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/[0.04]">
            <SmartImage
              key={previewURL}
              src={previewURL || null}
              alt={imageAlt || title || "پیش‌نمایش تصویر نوشته"}
              sizes="(min-width: 1024px) 320px, 100vw"
            />
          </div>
          <Label htmlFor="image_url" className="sr-only">
            نشانی تصویر شاخص
          </Label>
          <Controller
            control={control}
            name="image_url"
            render={({ field: imageField }) => (
              <Controller
                control={control}
                name="image_alt"
                render={({ field: altField }) => (
                  <ImageInput
                    ref={mediaRef}
                    id="image_url"
                    name={imageField.name}
                    urlInputRef={imageField.ref}
                    value={imageField.value}
                    onChange={imageField.onChange}
                    onBlur={imageField.onBlur}
                    owner={{
                      ownerType: "journal",
                      ownerId: post?.id,
                      role: "cover",
                    }}
                    placeholder="https://… یا بارگذاری فایل"
                    ariaInvalid={!!errors.image_url}
                    ariaDescribedBy={
                      errors.image_url ? fieldErrorId("image_url") : undefined
                    }
                    altValue={altField.value}
                    altInputId="image_alt"
                    altInputRef={altField.ref}
                    altDescription="تصویر را برای خواننده‌ای که آن را نمی‌بیند، کوتاه و دقیق توصیف کنید."
                    altError={errors.image_alt?.message}
                    onAltChange={altField.onChange}
                    onAltBlur={altField.onBlur}
                    hidePreview
                    onPreviewChange={setPreviewURL}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          />
          {errors.image_url ? (
            <p
              id={fieldErrorId("image_url")}
              role="alert"
              className="mt-2 text-xs text-destructive"
            >
              {errors.image_url.message}
            </p>
          ) : null}
        </div>

        <div className="border-hairline space-y-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <div>
            <Label htmlFor="status">وضعیت انتشار</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="status" className="mt-2 min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as JournalStatus[]).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="is_featured">نوشتهٔ ویژه</Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                در جایگاه برجستهٔ ژورنال نمایش داده می‌شود.
              </p>
            </div>
            <Controller
              control={control}
              name="is_featured"
              render={({ field }) => (
                <Switch
                  id="is_featured"
                  className="after:-inset-y-3"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
          {post ? (
            <div className="border-t border-border/50 pt-4 text-xs leading-5 text-muted-foreground">
              <p>آخرین ویرایش: {faDate(post.updated_at)}</p>
              <p>
                {post.published_at
                  ? `انتشار نخست: ${faDate(post.published_at)}`
                  : "هنوز منتشر نشده است"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl bg-primary/5 p-4 text-xs leading-5 text-muted-foreground ring-1 ring-primary/10">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <SearchCheck className="size-4 text-primary" aria-hidden /> پیش از
            انتشار
          </p>
          <p className="mt-2">
            عنوان روشن، خلاصهٔ مستقل، سرتیترهای منظم و متن جایگزین تصویر را
            بررسی کنید.
          </p>
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {mode === "create" ? "ساخت نوشته" : "ذخیرهٔ تغییرات"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSubmitting}
          onClick={() => router.push("/admin/journal")}
        >
          انصراف
        </Button>
        <p className="px-1 text-center text-xs text-muted-foreground">
          {status === "published"
            ? "نوشته پس از ذخیره در ژورنال عمومی دیده می‌شود."
            : status === "archived"
              ? "نوشته از ژورنال عمومی پنهان می‌شود."
              : "نوشته به‌صورت پیش‌نویس باقی می‌ماند."}
        </p>
      </aside>
    </form>
  );
}
