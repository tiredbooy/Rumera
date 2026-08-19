"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { FolderTree, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createJournalCategory,
  journalAdminKeys,
  JournalApiError,
  updateJournalCategory,
} from "@/features/journal/api/client";
import type { JournalCategory } from "@/features/journal/types";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import {
  journalCategoryFormDefaults,
  journalCategoryParentOptions,
  journalCategoryFormSchema,
  normalizeJournalSlug,
  toCreateJournalCategoryInput,
  toUpdateJournalCategoryInput,
  type JournalCategoryFormValues,
} from "@/features/journal/validations";

import { JournalFormField, JournalFormSection } from "./form-field";

const CATEGORY_FIELDS = new Set<keyof JournalCategoryFormValues>([
  "name",
  "slug",
  "description",
  "parent_id",
]);

export function JournalCategoryForm({
  mode,
  category,
  categories,
}: {
  mode: "create" | "edit";
  category?: JournalCategory;
  categories: JournalCategory[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<JournalCategoryFormValues>({
    resolver: zodResolver(journalCategoryFormSchema),
    defaultValues: journalCategoryFormDefaults(category),
  });
  const name = useWatch({ control, name: "name" });
  const slug = useWatch({ control, name: "slug" });
  const parentOptions = journalCategoryParentOptions(categories, category?.id);
  const guard = useUnsavedChangesGuard({
    enabled: isDirty,
    isSaving: isSubmitting,
  });

  React.useEffect(() => {
    if (slugTouched) return;
    setValue("slug", normalizeJournalSlug(name), { shouldValidate: false });
  }, [name, setValue, slugTouched]);

  function applyError(error: unknown) {
    if (error instanceof JournalApiError) {
      let focused = false;
      for (const [key, messages] of Object.entries(error.fields ?? {})) {
        if (!CATEGORY_FIELDS.has(key as keyof JournalCategoryFormValues))
          continue;
        setError(
          key as keyof JournalCategoryFormValues,
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
      error instanceof Error ? error.message : "ذخیرهٔ دسته ناموفق بود";
    setFormError(message);
    toast.error(message);
  }

  async function onSubmit(values: JournalCategoryFormValues) {
    setFormError(null);
    try {
      if (mode === "create") {
        await createJournalCategory(toCreateJournalCategoryInput(values));
        toast.success("دستهٔ ژورنال ساخته شد");
      } else if (category) {
        await updateJournalCategory(
          category.id,
          toUpdateJournalCategoryInput(values),
        );
        toast.success("تغییرات دسته ذخیره شد");
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: journalAdminKeys.categories(),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: journalAdminKeys.lists(),
          refetchType: "none",
        }),
      ]);
      guard.release();
      router.push("/admin/journal/categories");
      router.refresh();
    } catch (error) {
      applyError(error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      aria-busy={isSubmitting || undefined}
      className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
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
          title="اطلاعات دسته"
          description="دسته‌ها می‌توانند یک مادر داشته باشند و برای سازمان‌دهی نوشته‌ها استفاده می‌شوند."
        >
          <JournalFormField
            id="name"
            label="نام دسته"
            error={errors.name?.message}
            full
          >
            <Input
              id="name"
              autoComplete="off"
              disabled={isSubmitting}
              {...register("name")}
            />
          </JournalFormField>
          <JournalFormField
            id="slug"
            label="نامک"
            error={errors.slug?.message}
            hint="برای پیوندها و توسعهٔ آینده؛ فارسی و انگلیسی پشتیبانی می‌شوند."
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
            id="parent_id"
            label="دستهٔ مادر"
            error={errors.parent_id?.message}
            full
          >
            <Controller
              control={control}
              name="parent_id"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? "" : value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="parent_id" className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون دستهٔ مادر</SelectItem>
                    {parentOptions.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </JournalFormField>
          <JournalFormField
            id="description"
            label="توضیحات"
            error={errors.description?.message}
            hint="اختیاری؛ کاربرد این دسته را برای نویسندگان توضیح دهید."
            full
          >
            <Textarea
              id="description"
              rows={6}
              disabled={isSubmitting}
              {...register("description")}
            />
          </JournalFormField>
        </JournalFormSection>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">پیش‌نمایش</p>
          <div className="mt-4 flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <FolderTree className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {name.trim() || "نام دسته"}
              </span>
              <span
                className="block truncate text-xs text-muted-foreground"
                dir="auto"
              >
                {slug || "category-slug"}
              </span>
            </span>
          </div>
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {mode === "create" ? "ساخت دسته" : "ذخیرهٔ تغییرات"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSubmitting}
          onClick={() => guard.requestNavigation("/admin/journal/categories")}
        >
          انصراف
        </Button>
      </aside>

      <UnsavedChangesDialog {...guard.dialogProps} />
    </form>
  );
}
