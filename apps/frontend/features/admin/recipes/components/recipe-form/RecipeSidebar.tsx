"use client";

import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import type { Ref } from "react";

import { OptimizedImage } from "@/components/optimized-image";
import { Button } from "@/components/ui/button";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { Label } from "@/components/ui/label";
import { fieldErrorId } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageInput } from "@/features/image-uploader/ImageInput";
import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import { EditorActions } from "@/features/admin/shared/editor-actions";
import { MultiTagPicker } from "@/features/admin/shared/multi-tag-picker";
import {
  PUBLICATION_KIND_FA,
  PUBLICATION_KIND_HINT,
  type PublicationKind,
} from "@/features/admin/shared/publication";
import type { Tag } from "@/features/catalog/tags/types";
import type { RecipeStatus } from "@/features/recipes/types";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { cn } from "@/lib/utils";
import { Field } from "./FormLayout";

const statusFa: Record<RecipeStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "بایگانی‌شده",
};

function ImageCard({
  control,
  errors,
  title,
  imageUrl,
  imageAlt,
  ownerId,
  mediaRef,
  onPreviewChange,
  disabled,
}: {
  control: Control<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  title: string;
  imageUrl: string;
  imageAlt: string;
  ownerId?: number | null;
  mediaRef: Ref<ImageUploaderHandle<UploadedImage | null>>;
  onPreviewChange: (url: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
      <h2 className="eyebrow mb-3">
        <ImageIcon className="size-3.5" aria-hidden />
        تصویر شاخص
      </h2>
      <span className="relative mb-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/[0.04]">
        <OptimizedImage
          key={imageUrl}
          src={imageUrl || null}
          alt={imageAlt || title || "تصویر دستور"}
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
                owner={{ ownerType: "recipes", ownerId, role: "cover" }}
                placeholder="https://… یا بارگذاری فایل"
                ariaInvalid={!!errors.image_url}
                ariaDescribedBy={
                  errors.image_url ? fieldErrorId("image_url") : undefined
                }
                altValue={altField.value}
                altInputId="image_alt"
                altError={errors.image_alt?.message}
                onAltChange={altField.onChange}
                onAltBlur={altField.onBlur}
                hidePreview
                onPreviewChange={onPreviewChange}
                disabled={disabled}
              />
            )}
          />
        )}
      />
      {errors.image_url ? (
        <p
          id={fieldErrorId("image_url")}
          role="alert"
          className="mt-1.5 text-xs text-destructive"
        >
          {errors.image_url.message}
        </p>
      ) : null}
    </div>
  );
}

function PublicationCard({
  control,
  kind,
  disabled,
}: {
  control: Control<RecipeFormValues>;
  kind: PublicationKind;
  disabled?: boolean;
}) {
  const status = useWatch({ control, name: "status" });
  return (
    <div className="border-hairline flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
      <p
        role="status"
        className={cn(
          "rounded-xl px-3 py-2 text-xs font-medium ring-1",
          kind === "published" &&
            "bg-success/12 text-success ring-success/25",
          kind === "scheduled" &&
            "bg-info/12 text-info ring-info/25",
          kind === "draft" && "bg-muted text-muted-foreground ring-border/60",
          kind === "archived" &&
            "bg-warning/12 text-warning ring-warning/25",
        )}
      >
        {PUBLICATION_KIND_FA[kind]} — {PUBLICATION_KIND_HINT[kind]}
      </p>
      <Field id="status" label="وضعیت انتشار">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            >
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

      {status === "published" ? (
        <Field
          id="published_at"
          label="زمان انتشار (شمسی)"
          hint="خالی یعنی انتشار فوری. تاریخ آینده یعنی زمان‌بندی."
        >
          <Controller
            control={control}
            name="published_at"
            render={({ field }) => (
              <JalaliDateTimeInput
                id="published_at"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={disabled}
              />
            )}
          />
        </Field>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="is_featured">دستور ویژه</Label>
          <p className="text-xs text-muted-foreground">
            در بخش‌های منتخب سایت نمایش داده می‌شود.
          </p>
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
              disabled={disabled}
            />
          )}
        />
      </div>
    </div>
  );
}

function TagsCard({
  control,
  tags,
  disabled,
}: {
  control: Control<RecipeFormValues>;
  tags: Tag[];
  disabled?: boolean;
}) {
  return (
    <div className="border-hairline flex flex-col gap-2.5 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
      <Controller
        control={control}
        name="tag_ids"
        render={({ field }) => (
          <MultiTagPicker
            options={tags.map((t) => ({ id: t.id, title: t.title }))}
            value={field.value}
            onChange={field.onChange}
            emptyLabel="برچسبی برای انتخاب در دسترس نیست."
            disabled={disabled}
          />
        )}
      />
    </div>
  );
}

function FormActions({
  kind,
  submitLabel,
  isSubmitting,
  onCancel,
  onDelete,
  isDeleting,
  canDelete,
  canWrite = true,
}: {
  kind: PublicationKind;
  submitLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  canDelete?: boolean;
  canWrite?: boolean;
}) {
  const busy = isSubmitting || Boolean(isDeleting);
  return (
    <EditorActions
      submitLabel={submitLabel}
      isSubmitting={busy}
      onCancel={onCancel}
      hint={canWrite ? PUBLICATION_KIND_HINT[kind] : undefined}
      canWrite={canWrite}
    >
      {canWrite && canDelete && onDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="lg"
          disabled={busy}
          onClick={onDelete}
          className="cursor-pointer"
        >
          {isDeleting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          {isDeleting ? "در حال حذف…" : "حذف دستور"}
        </Button>
      ) : null}
    </EditorActions>
  );
}

export function RecipeSidebar({
  control,
  errors,
  tags,
  title,
  imageUrl,
  imageAlt,
  publicationKind: kind,
  submitLabel,
  isSubmitting,
  ownerId,
  mediaRef,
  onPreviewChange,
  disabled,
  canWrite = true,
  onCancel,
  onDelete,
  isDeleting,
  canDelete,
}: {
  control: Control<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  tags: Tag[];
  title: string;
  imageUrl: string;
  imageAlt: string;
  publicationKind: PublicationKind;
  submitLabel: string;
  isSubmitting: boolean;
  ownerId?: number | null;
  mediaRef: Ref<ImageUploaderHandle<UploadedImage | null>>;
  onPreviewChange: (url: string) => void;
  disabled?: boolean;
  canWrite?: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  canDelete?: boolean;
}) {
  return (
    <aside className="flex flex-col gap-6">
      <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
        <ImageCard
          control={control}
          errors={errors}
          title={title}
          imageUrl={imageUrl}
          imageAlt={imageAlt}
          ownerId={ownerId}
          mediaRef={mediaRef}
          onPreviewChange={onPreviewChange}
          disabled={disabled}
        />
        <PublicationCard control={control} kind={kind} disabled={disabled} />
        <TagsCard control={control} tags={tags} disabled={disabled} />
        <FormActions
          kind={kind}
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
          onDelete={onDelete}
          isDeleting={isDeleting}
          canDelete={canDelete}
          canWrite={canWrite}
        />
      </div>
    </aside>
  );
}
